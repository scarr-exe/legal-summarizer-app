'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth-context';
import { getDocument, deleteDocument, DocumentDetail, ApiError } from '@/lib/api';
import { labelFor, toneFor, typePriority, sortClausesForDisplay } from '@/lib/clause-types';
import StatusBadge from '@/components/StatusBadge';
import ClauseTypeChart from '@/components/ClauseTypeChart';
import ContractTimeline from '@/components/ContractTimeline';
import ClauseFilters from '@/components/ClauseFilters';
import ConfirmDialog from '@/components/ConfirmDialog';
import Reveal from '@/components/Reveal';

export default function DocumentSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isLoading: authLoading, getValidAccessToken } = useRequireAuth();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getValidAccessToken();
      const data = await getDocument(id, token);
      setDoc(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this document.');
    }
  }, [id, getValidAccessToken]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = await getValidAccessToken();
      await deleteDocument(id, token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this document.');
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  if (authLoading || !user) return null;

  if (error && !doc) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-7xl space-y-3 px-6 py-16">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-56 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      </div>
    );
  }

  const orderedClauses = sortClausesForDisplay(doc.clauses);

  const availableTypes = Object.entries(
    orderedClauses.reduce<Record<string, number>>((acc, c) => {
      acc[c.clause_type] = (acc[c.clause_type] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([type, count]) => ({ type, label: labelFor(type), count }))
    .sort((a, b) => typePriority(a.type) - typePriority(b.type));

  const normalizedQuery = query.trim().toLowerCase();
  const filteredClauses = orderedClauses.filter((c) => {
    const matchesType = selectedTypes.size === 0 || selectedTypes.has(c.clause_type);
    const matchesQuery =
      normalizedQuery === '' ||
      c.original_text.toLowerCase().includes(normalizedQuery) ||
      (c.summary?.summary_text ?? '').toLowerCase().includes(normalizedQuery);
    return matchesType && matchesQuery;
  });

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="animate-rise">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          ← Documents
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{doc.file_name}</h1>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {doc.clauses.length} clauses · uploaded{' '}
              {new Date(doc.upload_date).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={doc.status} />
            <button
              onClick={() => setConfirmOpen(true)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:border-red-400 hover:text-red-600 dark:hover:text-red-400"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {doc.status !== 'complete' ? (
        <p className="mt-10 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--muted)]">
          This document hasn&apos;t finished processing yet. Refresh this page in a moment.
        </p>
      ) : (
        <>
          {doc.clauses.length > 0 && (
            <Reveal className="mt-8">
              <div className="grid items-start gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-[var(--muted)]">
                    Clause-type distribution
                  </h2>
                  <ClauseTypeChart clauses={doc.clauses} />
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  <h2 className="mb-5 text-sm font-medium uppercase tracking-wider text-[var(--muted)]">
                    Contract timeline
                  </h2>
                  <ContractTimeline
                    startDate={doc.start_date}
                    endDate={doc.end_date}
                    renewalDate={doc.renewal_date}
                  />
                </div>
              </div>
            </Reveal>
          )}

          {orderedClauses.length > 0 && (
            <Reveal delay={80} className="mt-8">
              <ClauseFilters
                query={query}
                onQueryChange={setQuery}
                availableTypes={availableTypes}
                selectedTypes={selectedTypes}
                onToggleType={toggleType}
                onClearTypes={() => setSelectedTypes(new Set())}
                visibleCount={filteredClauses.length}
                totalCount={orderedClauses.length}
              />
            </Reveal>
          )}

          {orderedClauses.length > 0 && filteredClauses.length === 0 && (
            <p className="mt-8 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--muted)]">
              No clauses match your search or filters.
            </p>
          )}

          {/* Identified clause types first, unclassified 'other' last — see
              sortClausesForDisplay. Two columns on wide screens so the page
              uses the available width instead of one long single column. */}
          <section className="mt-8 grid items-start gap-5 lg:grid-cols-2">
            {filteredClauses.map((clause, i) => (
              <Reveal key={clause.id} delay={Math.min(i * 45, 270)}>
                <article className="h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--accent)]/40">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
                      Clause {clause.position + 1}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${toneFor(
                        clause.clause_type
                      )}`}
                    >
                      {labelFor(clause.clause_type)}
                    </span>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                        Original
                      </h3>
                      <p className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-[var(--muted)]">
                        {clause.original_text}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-4">
                      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--accent)]">
                        Plain language
                      </h3>
                      {/* Same 12.5px size as the original column. Previously
                          this was text-sm (14px) against the original's
                          12.5px mono, so a summary could occupy more space
                          than the clause it summarised even when it had
                          fewer words. Matching the size lets the length
                          difference actually read as one. */}
                      <p className="text-[12.5px] leading-relaxed">
                        {clause.summary?.summary_text ?? '—'}
                      </p>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this document?"
        body={
          <>
            <span className="font-medium text-[var(--foreground)]">{doc.file_name}</span> and its{' '}
            {doc.clauses.length} clause{doc.clauses.length === 1 ? '' : 's'} will be permanently
            removed. This cannot be undone.
          </>
        }
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}