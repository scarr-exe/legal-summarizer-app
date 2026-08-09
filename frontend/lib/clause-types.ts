import type { Clause } from './api';

/** Single source of truth for how clause types are labelled, coloured, and
 * ordered. Previously these maps were duplicated between the chart and the
 * summary page, which is how the two drifted out of sync (the chart was
 * missing 'duration' entirely after the backend added that category). */

export const CLAUSE_TYPE_LABELS: Record<string, string> = {
  payment: 'Payment',
  termination: 'Termination',
  confidentiality: 'Confidentiality',
  renewal: 'Renewal',
  duration: 'Duration',
  other: 'Other',
};

/** Hex values for the charts. Brightened for the dark slate surfaces the
 * redesign introduced -- the previous deeper tones muddied against them.
 *
 * Duration is orange rather than the mockup's gold on purpose: the brand
 * accent is amber, and a gold "Duration" chip sitting beside an amber
 * button makes the reader unsure whether colour here means "category" or
 * "clickable". Orange keeps the mockup's warm read without that clash. */
export const CLAUSE_TYPE_COLORS: Record<string, string> = {
  payment: '#2dd4bf',
  termination: '#fb7185',
  confidentiality: '#60a5fa',
  renewal: '#a78bfa',
  duration: '#f97316',
  other: '#94a3b8',
};

/** Tailwind classes for the badges, tinted from the same hues. */
export const CLAUSE_TYPE_TONES: Record<string, string> = {
  payment: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
  termination: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  confidentiality: 'bg-blue-500/12 text-blue-700 dark:text-blue-300',
  renewal: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  duration: 'bg-orange-500/12 text-orange-700 dark:text-orange-300',
  other: 'bg-slate-500/12 text-slate-600 dark:text-slate-300',
};

/** Display priority. Everything the classifier actually recognised comes
 * first; unrecognised 'other' clauses sink to the bottom, since they carry
 * the least information and shouldn't push identified clauses down. */
const TYPE_PRIORITY: Record<string, number> = {
  payment: 0,
  termination: 1,
  confidentiality: 2,
  renewal: 3,
  duration: 4,
  other: 99,
};

export function typePriority(clauseType: string): number {
  return TYPE_PRIORITY[clauseType] ?? 50;
}

export function labelFor(clauseType: string): string {
  return CLAUSE_TYPE_LABELS[clauseType] ?? clauseType;
}

export function colorFor(clauseType: string): string {
  return CLAUSE_TYPE_COLORS[clauseType] ?? CLAUSE_TYPE_COLORS.other;
}

export function toneFor(clauseType: string): string {
  return CLAUSE_TYPE_TONES[clauseType] ?? CLAUSE_TYPE_TONES.other;
}

/** Identified clause types first, 'other' last; original document order
 * preserved within each group. Returns a new array — never mutates. */
export function sortClausesForDisplay(clauses: Clause[]): Clause[] {
  return [...clauses].sort((a, b) => {
    const byType = typePriority(a.clause_type) - typePriority(b.clause_type);
    return byType !== 0 ? byType : a.position - b.position;
  });
}