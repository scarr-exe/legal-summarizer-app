'use client';

/**
 * Plots a contract's derived start/end dates as a horizontal timeline,
 * with an optional renewal marker and a "today" indicator when the
 * contract is currently running.
 *
 * Built with plain markup rather than Recharts: this is a single date
 * range with a couple of point markers, which Recharts has no native
 * chart type for — forcing it into a bar chart would be more code and
 * less control than positioning three markers along a track.
 *
 * Date extraction is deliberately conservative (see the backend's
 * date_extractor.py), so null dates are the normal case, not an error.
 * This component therefore degrades in three steps: full range -> a plain
 * list of whichever single dates were found -> an explanatory empty state.
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

function describeDuration(start: Date, end: Date): string {
  const totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (totalMonths >= 12 && totalMonths % 12 === 0) {
    const years = totalMonths / 12;
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  if (totalMonths >= 1) {
    return `${totalMonths} month${totalMonths === 1 ? '' : 's'}`;
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-8 text-center">
      <p className="text-sm font-medium">No dates detected</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--muted)]">
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
    <div className="flex flex-wrap gap-x-10 gap-y-3">
      {items.map(({ label, date }) => (
        <div key={label}>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatDate(date)}</p>
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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <span className="text-2xl font-semibold tabular-nums">
            {describeDuration(start, end)}
          </span>
          <span className="ml-1.5 text-sm text-[var(--muted)]">term</span>
        </div>
        {todayInRange && (
          <div>
            <span className="text-2xl font-semibold tabular-nums">
              {Math.round(pct(today))}%
            </span>
            <span className="ml-1.5 text-sm text-[var(--muted)]">elapsed</span>
          </div>
        )}
        {renewal && (
          <div>
            <span className="text-sm text-[var(--muted)]">
              Renews {formatDate(renewal)}
            </span>
          </div>
        )}
      </div>

      {/* Track. pt/pb leave room for the labels sitting above and below. */}
      <div className="relative pb-10 pt-8">
        <div className="relative h-2 w-full rounded-full bg-[var(--surface-muted)]">
          {/* Elapsed portion, only meaningful while the contract is running. */}
          {todayInRange && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]/35"
              style={{ width: `${pct(today)}%` }}
            />
          )}

          <span className="absolute -left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-emerald-500" />
          <span className="absolute -right-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-rose-500" />

          {renewalInRange && renewal && (
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-[var(--surface)] bg-violet-500"
              style={{ left: `${pct(renewal)}%` }}
              title={`Renews ${formatDate(renewal)}`}
            />
          )}

          {todayInRange && (
            <span
              className="absolute -top-3 h-8 w-0.5 -translate-x-1/2 bg-[var(--foreground)]"
              style={{ left: `${pct(today)}%` }}
              title={`Today — ${formatDate(today)}`}
            />
          )}

          {/* Endpoint labels, anchored to the track ends. */}
          <div className="absolute -bottom-8 left-0 text-left">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Start
            </p>
            <p className="text-sm font-medium tabular-nums">{formatDate(start)}</p>
          </div>
          <div className="absolute -bottom-8 right-0 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
              End
            </p>
            <p className="text-sm font-medium tabular-nums">{formatDate(end)}</p>
          </div>

          {todayInRange && (
            <div
              className="absolute -top-8 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${pct(today)}%` }}
            >
              <p className="text-[11px] font-medium uppercase tracking-wider">Today</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
