'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth-context';
import { getDocument, DocumentDetail, ApiError } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import ClauseTypeChart from '@/components/ClauseTypeChart';
import Reveal from '@/components/Reveal';

const CLAUSE_TYPE_LABELS: Record<string, string> = {
  payment: 'Payment',
  termination: 'Termination',
  confidentiality: 'Confidentiality',
  renewal: 'Renewal',
  duration: 'Duration',
  other: 'Other',
};

const CLAUSE_TYPE_TONES: Record<string, string> = {
  payment: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  termination: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  confidentiality: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  renewal: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  duration: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  other: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
};

export default function DocumentSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isLoading: authLoading, getValidAccessToken } = useRequireAuth();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (authLoading || !user) return null;

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-6 py-16">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-[260px] animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
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
          <StatusBadge status={doc.status} />
        </div>
      </div>

      {doc.status !== 'complete' ? (
        <p className="mt-10 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--muted)]">
          This document hasn&apos;t finished processing yet. Refresh this page in a moment.
        </p>
      ) : (
        <>
          {doc.clauses.length > 0 && (
            <Reveal className="mt-10">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <h2 className="mb-4 text-sm font-medium text-[var(--muted)]">
                  Clause-type distribution
                </h2>
                <ClauseTypeChart clauses={doc.clauses} />
              </div>
            </Reveal>
          )}

          <section className="mt-8 flex flex-col gap-4">
            {doc.clauses.map((clause, i) => (
              <Reveal key={clause.id} delay={Math.min(i * 60, 300)}>
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--accent)]/30">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
                      Clause {clause.position + 1}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        CLAUSE_TYPE_TONES[clause.clause_type] ?? CLAUSE_TYPE_TONES.other
                      }`}
                    >
                      {CLAUSE_TYPE_LABELS[clause.clause_type] ?? clause.clause_type}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                        Original
                      </h3>
                      <p className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-[var(--muted)]">
                        {clause.original_text}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--accent-soft)] p-4">
                      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--accent)]">
                        Plain language
                      </h3>
                      <p className="text-sm leading-relaxed">
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
    </div>
  );
}
