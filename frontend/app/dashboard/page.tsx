'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth-context';
import { listDocuments, DocumentSummary, ApiError } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';

/** The Chapter 4.2 "Control Centre" — a history list of everything the
 * current user has uploaded, with quick links into each summary view. */
export default function DashboardPage() {
  const { user, isLoading: authLoading, getValidAccessToken } = useRequireAuth();
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getValidAccessToken();
      const docs = await listDocuments(token);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your documents.');
    }
  }, [getValidAccessToken]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading || !user) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="animate-rise mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your documents</h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Every contract you have summarized, newest first.
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-lg bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] transition-transform hover:scale-[1.03] active:scale-95"
        >
          Upload document
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {documents === null && !error ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      ) : documents && documents.length === 0 ? (
        <div className="animate-rise rounded-2xl border border-dashed border-[var(--border)] px-6 py-16 text-center">
          <p className="font-medium">No documents yet</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--muted)]">
            Upload your first contract and every clause will be summarized in plain English.
          </p>
          <Link
            href="/upload"
            className="mt-6 inline-block rounded-lg bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition-transform hover:scale-[1.03]"
          >
            Upload a document
          </Link>
        </div>
      ) : (
        <div className="animate-rise overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">File</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">Type</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Uploaded</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {documents?.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-t border-[var(--border)] transition-colors first:border-t-0 hover:bg-[var(--surface-muted)]"
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="font-medium transition-colors hover:text-[var(--accent)]"
                    >
                      {doc.file_name}
                    </Link>
                  </td>
                  <td className="hidden px-5 py-4 font-mono text-xs uppercase text-[var(--muted)] sm:table-cell">
                    {doc.file_type}
                  </td>
                  <td className="hidden px-5 py-4 text-[var(--muted)] md:table-cell">
                    {new Date(doc.upload_date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={doc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
