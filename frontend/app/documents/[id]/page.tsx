'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth-context';
import { getDocument, DocumentDetail, ApiError } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import ClauseTypeChart from '@/components/ClauseTypeChart';

const CLAUSE_TYPE_LABELS: Record<string, string> = {
  payment: 'Payment',
  termination: 'Termination',
  confidentiality: 'Confidentiality',
  renewal: 'Renewal',
  other: 'Other',
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
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{doc.file_name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Uploaded {new Date(doc.upload_date).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      {doc.status !== 'complete' ? (
        <p className="text-sm text-zinc-500">
          This document hasn&apos;t finished processing yet. Refresh this page in a moment.
        </p>
      ) : (
        <>
          {doc.clauses.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Clause-type distribution
              </h2>
              <ClauseTypeChart clauses={doc.clauses} />
            </section>
          )}

          <section className="flex flex-col gap-6">
            {doc.clauses.map((clause) => (
              <article
                key={clause.id}
                className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Clause {clause.position + 1}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {CLAUSE_TYPE_LABELS[clause.clause_type] ?? clause.clause_type}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-1 text-xs font-medium text-zinc-500">Original text</h3>
                    <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {clause.original_text}
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-medium text-zinc-500">Plain-language summary</h3>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {clause.summary?.summary_text ?? '—'}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
