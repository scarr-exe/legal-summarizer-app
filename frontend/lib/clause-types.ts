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

/** Hex values for the chart. Spread around the colour wheel so adjacent
 * bars stay distinguishable, and deliberately clear of the amber UI accent
 * so category colour never reads as "interactive". */
export const CLAUSE_TYPE_COLORS: Record<string, string> = {
  payment: '#059669',
  termination: '#e11d48',
  confidentiality: '#2563eb',
  renewal: '#0891b2',
  duration: '#ea580c',
  other: '#a8a29e',
};

/** Tailwind classes for the badges, tinted from the same hues. */
export const CLAUSE_TYPE_TONES: Record<string, string> = {
  payment: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  termination: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  confidentiality: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  renewal: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  duration: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  other: 'bg-stone-500/10 text-stone-600 dark:text-stone-400',
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