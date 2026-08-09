'use client';

import type { Clause } from '@/lib/api';
import { labelFor, colorFor, typePriority } from '@/lib/clause-types';

/**
 * Clause-type distribution: a labelled bar list beside a donut.
 *
 * The mockup drew the right-hand figure as concentric arcs of differing
 * radii. That is replaced with a donut here, because concentric arcs
 * encode value as arc length while each ring has a different
 * circumference -- so two categories with the same count render at
 * visibly different lengths, and a larger count on an inner ring can look
 * smaller than a lesser one on an outer ring. A donut divides a single
 * circle by angle, so equal counts always look equal.
 *
 * Built with plain SVG/CSS rather than Recharts: these are pill bars and
 * one ring, and hand-rolling them is less code than bending a chart
 * library's bar renderer into the mockup's shape.
 */

interface Row {
  type: string;
  label: string;
  count: number;
  color: string;
  share: number;
}

function buildRows(clauses: Clause[]): Row[] {
  const counts = new Map<string, number>();
  for (const clause of clauses) {
    counts.set(clause.clause_type, (counts.get(clause.clause_type) ?? 0) + 1);
  }

  return Array.from(counts, ([type, count]) => ({
    type,
    label: labelFor(type),
    count,
    color: colorFor(type),
    share: clauses.length ? (count / clauses.length) * 100 : 0,
  })).sort((a, b) => {
    // 'other' always sinks to the bottom; the rest rank by frequency.
    const aOther = typePriority(a.type) >= 99 ? 1 : 0;
    const bOther = typePriority(b.type) >= 99 ? 1 : 0;
    return aOther !== bOther ? aOther - bOther : b.count - a.count;
  });
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Donut({ rows, total }: { rows: Row[]; total: number }) {
  let offset = 0;

  return (
    <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
      <circle
        cx="70"
        cy="70"
        r={RADIUS}
        fill="none"
        stroke="var(--border)"
        strokeWidth="14"
        opacity="0.5"
      />
      {rows.map((row) => {
        const length = (row.count / total) * CIRCUMFERENCE;
        // 1.5px visual gap between segments, but never so large that a
        // single-clause segment disappears entirely.
        const gap = Math.min(1.5, length / 3);
        const segment = (
          <circle
            key={row.type}
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            stroke={row.color}
            strokeWidth="14"
            strokeLinecap="butt"
            strokeDasharray={`${Math.max(length - gap, 0.5)} ${CIRCUMFERENCE}`}
            strokeDashoffset={-offset}
          >
            <title>{`${row.label}: ${row.count} (${Math.round(row.share)}%)`}</title>
          </circle>
        );
        offset += length;
        return segment;
      })}
    </svg>
  );
}

export default function ClauseTypeChart({ clauses }: { clauses: Clause[] }) {
  const rows = buildRows(clauses);
  const total = clauses.length;
  const identified = clauses.filter((c) => c.clause_type !== 'other').length;
  const max = Math.max(...rows.map((r) => r.count), 1);

  if (!total) {
    return (
      <p className="text-sm text-[var(--muted)]">No clauses to chart.</p>
    );
  }

  return (
    <div>
      <p className="mb-6 text-sm text-[var(--muted)]">
        {total} clauses · {identified} identified by type · {rows.length}{' '}
        {rows.length === 1 ? 'category' : 'categories'}
      </p>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
        <div className="w-full flex-1 space-y-3">
          {rows.map((row) => (
            <div key={row.type} className="flex items-center gap-3 text-sm">
              {/* Narrower label column on phones so the bar itself still has
                  room to be readable at ~320px. */}
              <span className="w-[5.5rem] shrink-0 truncate text-xs text-[var(--muted)] sm:w-28 sm:text-sm">
                {row.label}
              </span>
              <div className="flex-1">
                <div
                  className="h-5 rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max((row.count / max) * 100, 8)}%`,
                    backgroundColor: row.color,
                  }}
                />
              </div>
              <span className="w-5 shrink-0 text-right tabular-nums text-[var(--muted)]">
                {row.count}
              </span>
            </div>
          ))}
        </div>

        <div className="relative h-36 w-36 shrink-0">
          <Donut rows={rows} total={total} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums leading-none">{total}</span>
            <span className="mt-1 text-[11px] text-[var(--muted)]">clauses</span>
          </div>
        </div>
      </div>
    </div>
  );
}
