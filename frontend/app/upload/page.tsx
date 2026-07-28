'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth-context';
import { uploadDocument, processDocument, ApiError } from '@/lib/api';

type Stage = 'idle' | 'uploading' | 'processing' | 'error';

const STAGE_LABEL: Record<Stage, string> = {
  idle: '',
  uploading: 'Uploading and extracting text…',
  processing: 'Identifying clauses and generating summaries — this can take a little while…',
  error: '',
};

export default function UploadPage() {
  const { user, isLoading: authLoading, getValidAccessToken } = useRequireAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setError(null);
    try {
      setStage('uploading');
      const token = await getValidAccessToken();
      const uploaded = await uploadDocument(file, token);

      setStage('processing');
      const freshToken = await getValidAccessToken();
      await processDocument(uploaded.id, freshToken);

      router.push(`/documents/${uploaded.id}`);
    } catch (err) {
      setStage('error');
      setError(err instanceof ApiError ? err.message : 'Something went wrong during processing.');
    }
  }

  if (authLoading || !user) return null;

  const busy = stage === 'uploading' || stage === 'processing';

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Upload a contract</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        PDF or DOCX, up to 10MB. The system will split it into clauses, classify each one, and
        generate a plain-language summary.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileChange}
          disabled={busy}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-500" />
            {STAGE_LABEL[stage]}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || busy}
          className="rounded-full bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
        >
          {busy ? 'Working…' : 'Upload and summarize'}
        </button>
      </form>
    </div>
  );
}
