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
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your documents</h1>
        <Link
          href="/upload"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
        >
          Upload a document
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {documents === null && !error ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : documents && documents.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No documents yet. <Link href="/upload" className="underline">Upload your first contract</Link> to get started.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {documents?.map((doc) => (
                <tr key={doc.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-3">
                    <Link href={`/documents/${doc.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                      {doc.file_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 uppercase text-zinc-500">{doc.file_type}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(doc.upload_date).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
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
