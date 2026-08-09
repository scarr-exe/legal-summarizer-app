'use client';

/**
 * Plots a contract's derived start/end dates as a horizontal timeline,
 * with an optional renewal marker and a "today" indicator when the
 * contract is currently running.
 *
 * Built with plain markup rather than Recharts: this is a single date
 * range with a couple of point markers, which Recharts has no native
 * chart type for.
 *
 * Date extraction is deliberately conservative (see the backend's
 * date_extractor.py), so null dates are the normal case, not an error.
 * This component therefore degrades in three steps: full range -> a plain
 * list of whichever single dates were found -> an explanatory empty state.
 *
 * The redesign mockup dropped the renewal and "today" markers and showed
 * only decorative tick marks. Both markers are kept: a renewal date and
 * how far through the term you are carry real information, which
 * evenly-spaced ticks do not.
 */

interface ContractTimelineProps {
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
}

/** Parses "YYYY-MM-DD" into a *local* date.
 *
 * `new Date('2026-08-01')` is parsed as UTC midnight, which renders as
 * 31 July in any timezone behind UTC — an off-by-one-day bug on a
 * component whose entire job is showing dates. Splitting the parts and
 * using the local Date constructor avoids it. */
function parseISODate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Human term length.
 *
 * Rounds to whole years when the range is within a few days of one. A
 * 1 Sept 2026 -> 31 Aug 2028 contract is one day short of two years, and
 * counting whole calendar months called that "23 months" — technically
 * defensible but not how anyone describes a two-year contract. */
function describeDuration(start: Date, end: Date): { value: string; unit: string } {
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);

  const years = days / 365.25;
  const nearestYear = Math.round(years);
  if (nearestYear >= 1 && Math.abs(days - nearestYear * 365.25) <= 5) {
    return { value: String(nearestYear), unit: nearestYear === 1 ? 'year term' : 'years term' };
  }

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months >= 1) {
    return { value: String(months), unit: months === 1 ? 'month term' : 'months term' };
  }
  return { value: String(days), unit: days === 1 ? 'day term' : 'days term' };
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center">
      <p className="text-sm font-medium">No dates detected</p>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[var(--muted)]">
        This contract doesn&apos;t state its start or end date in a format the system
        could read with confidence. Dates written in plain terms — &ldquo;1st August
        2026&rdquo; — are detected; relative ones like &ldquo;30 days after
        signing&rdquo; are not.
      </p>
    </div>
  );
}

/** Shown when only some dates were found: a range can't be drawn, so the
 * dates are listed as plain facts instead of implying a span we don't
 * actually know. */
function PartialDates({ items }: { items: { label: string; date: Date }[] }) {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
      {items.map(({ label, date }) => (
        <div key={label}>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatDate(date)}</p>
        </div>
      ))}
      <p className="w-full text-xs text-[var(--muted)]">
        Only part of the contract term was detected, so the full span isn&apos;t shown.
      </p>
    </div>
  );
}

export default function ContractTimeline({
  startDate,
  endDate,
  renewalDate,
}: ContractTimelineProps) {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  const renewal = parseISODate(renewalDate);

  if (!start && !end && !renewal) return <EmptyState />;

  // Without both ends there's no span to scale against, so fall back to
  // listing whatever was found rather than drawing a misleading bar.
  if (!start || !end || end <= start) {
    const items: { label: string; date: Date }[] = [];
    if (start) items.push({ label: 'Starts', date: start });
    if (end) items.push({ label: 'Ends', date: end });
    if (renewal) items.push({ label: 'Renews', date: renewal });
    return <PartialDates items={items} />;
  }

  const span = end.getTime() - start.getTime();
  const pct = (d: Date) => ((d.getTime() - start.getTime()) / span) * 100;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayInRange = today >= start && today <= end;
  const renewalInRange = renewal !== null && renewal > start && renewal < end;
  const term = describeDuration(start, end);

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="mb-2 text-center">
        <span className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
          {term.value}
        </span>
        <span className="ml-2 text-lg text-[var(--muted)] sm:text-2xl">{term.unit}</span>
      </div>

      {todayInRange && (
        <p className="mb-8 text-center text-sm text-[var(--muted)]">
          {Math.round(pct(today))}% elapsed
          {renewal && <> · renews {formatDate(renewal)}</>}
        </p>
      )}
      {!todayInRange && renewal && (
        <p className="mb-8 text-center text-sm text-[var(--muted)]">
          Renews {formatDate(renewal)}
        </p>
      )}
      {!todayInRange && !renewal && <div className="mb-8" />}

      <div className="relative px-1">
        <div
          className="relative h-1.5 w-full rounded-full"
          style={{
            background:
              'linear-gradient(90deg, var(--tl-start) 0%, var(--tl-end) 100%)',
            // Endpoints tinted to their marker colours so the track reads
            // as running from "starts" to "ends".
            ['--tl-start' as string]: 'rgba(45,212,191,0.55)',
            ['--tl-end' as string]: 'rgba(251,113,133,0.55)',
          }}
        >
          {/* Elapsed portion, only meaningful while the contract runs. */}
          {todayInRange && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
              style={{ width: `${pct(today)}%` }}
            />
          )}

          <span className="absolute -left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-[3px] border-[var(--surface)] bg-teal-400" />
          <span className="absolute -right-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-[3px] border-[var(--surface)] bg-rose-400" />

          {renewalInRange && renewal && (
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-[var(--surface)] bg-violet-400"
              style={{ left: `${pct(renewal)}%` }}
              title={`Renews ${formatDate(renewal)}`}
            />
          )}

          {todayInRange && (
            <span
              className="absolute -top-2.5 h-6 w-0.5 -translate-x-1/2 rounded-full bg-[var(--foreground)]"
              style={{ left: `${pct(today)}%` }}
              title={`Today — ${formatDate(today)}`}
            />
          )}
        </div>

        <div className="mt-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium tabular-nums">{formatDate(start)}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-teal-500 dark:text-teal-400">
              Start
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium tabular-nums">{formatDate(end)}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-rose-500 dark:text-rose-400">
              End
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
