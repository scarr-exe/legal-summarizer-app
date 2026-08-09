'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth-context';
import { listDocuments, deleteDocument, DocumentSummary, ApiError } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import FileTypeIcon from '@/components/FileTypeIcon';
import ConfirmDialog from '@/components/ConfirmDialog';

/** The Chapter 4.2 "Control Centre" — a history list of everything the
 * current user has uploaded, with quick links into each summary view.
 *
 * Rebuilt from the redesign mockup: separated card rows rather than a
 * table, with colour-coded file-type icons carrying the format so the
 * "Type" column could go. */
export default function DashboardPage() {
  const { user, isLoading: authLoading, getValidAccessToken } = useRequireAuth();
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const token = await getValidAccessToken();
      await deleteDocument(pendingDelete.id, token);
      setDocuments((prev) => prev?.filter((d) => d.id !== pendingDelete.id) ?? null);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that document.');
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || !user) return null;

  return (
    <div className="relative">
      <div className="ambient" aria-hidden />

      <div className="relative mx-auto max-w-5xl px-6 py-14">
        <div className="animate-rise mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Your documents</h1>
            <p className="mt-2 text-[var(--muted)]">
              Every contract you have summarized, newest first.
            </p>
          </div>
          <Link
            href="/upload"
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#1a1200] transition-all hover:opacity-90 active:scale-95"
          >
            Upload document
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        {documents === null && !error ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[76px] animate-pulse rounded-2xl bg-[var(--surface-muted)]"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        ) : documents && documents.length === 0 ? (
          <div className="animate-rise rounded-2xl border border-dashed border-[var(--border)] px-6 py-20 text-center">
            <p className="text-lg font-medium">No documents yet</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--muted)]">
              Upload your first contract and every clause will be summarized in plain
              English.
            </p>
            <Link
              href="/upload"
              className="mt-7 inline-block rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#1a1200] transition-transform hover:scale-[1.03]"
            >
              Upload a document
            </Link>
          </div>
        ) : (
          <div className="animate-rise space-y-3">
            {documents?.map((doc) => (
              <div
                key={doc.id}
                className="card group flex items-center gap-4 px-5 py-4 transition-all hover:border-[var(--accent)]/40"
              >
                <FileTypeIcon fileType={doc.file_type} />

                <Link
                  href={`/documents/${doc.id}`}
                  className="min-w-0 flex-1 font-medium transition-colors hover:text-[var(--accent)]"
                >
                  <span className="block truncate">{doc.file_name}</span>
                </Link>

                <span className="hidden whitespace-nowrap text-sm text-[var(--muted)] md:block">
                  {new Date(doc.upload_date).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>

                <StatusBadge status={doc.status} />

                <button
                  onClick={() => setPendingDelete(doc)}
                  aria-label={`Delete ${doc.file_name}`}
                  title="Delete"
                  className="rounded-lg p-2 text-[var(--muted)] opacity-60 transition-all hover:bg-rose-500/10 hover:text-rose-500 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this document?"
        body={
          <>
            <span className="font-medium text-[var(--foreground)]">
              {pendingDelete?.file_name}
            </span>{' '}
            and all of its clauses and summaries will be permanently removed. This cannot be
            undone.
          </>
        }
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
