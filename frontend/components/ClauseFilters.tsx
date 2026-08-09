'use client';

interface TypeCount {
  type: string;
  label: string;
  count: number;
}

interface ClauseFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  availableTypes: TypeCount[];
  selectedTypes: Set<string>;
  onToggleType: (type: string) => void;
  onClearTypes: () => void;
  visibleCount: number;
  totalCount: number;
}

export default function ClauseFilters({
  query,
  onQueryChange,
  availableTypes,
  selectedTypes,
  onToggleType,
  onClearTypes,
  visibleCount,
  totalCount,
}: ClauseFiltersProps) {
  const allActive = selectedTypes.size === 0;

  return (
    // Single rounded container holding search, chips and the count, per
    // the mockup — rather than three separate stacked rows.
    <div className="card flex flex-col gap-4 rounded-2xl px-4 py-3 lg:flex-row lg:items-center lg:gap-5">
      <div className="relative shrink-0 sm:w-72">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search clause text or summaries…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-9 text-sm outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
      </div>

      <div className="flex flex-wrap gap-2 lg:flex-1">
        <button
          type="button"
          onClick={onClearTypes}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            allActive
              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'
          }`}
        >
          All
        </button>
        {availableTypes.map(({ type, label, count }) => {
          const active = selectedTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => onToggleType(type)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'
              }`}
            >
              {label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <span className="shrink-0 whitespace-nowrap text-xs text-[var(--muted)]">
        Showing {visibleCount} of {totalCount}
      </span>
    </div>
  );
}
