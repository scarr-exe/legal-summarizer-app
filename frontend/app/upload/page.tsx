'use client';

import { useState, FormEvent, ChangeEvent, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth-context';
import { uploadDocument, processDocument, ApiError } from '@/lib/api';

type Stage = 'idle' | 'uploading' | 'processing' | 'error';

const STEPS = [
  { key: 'uploading', label: 'Extracting text' },
  { key: 'processing', label: 'Identifying clauses & summarizing' },
] as const;

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const { user, isLoading: authLoading, getValidAccessToken } = useRequireAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function selectFile(next: File | null) {
    setFile(next);
    setError(null);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    selectFile(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files?.[0] ?? null);
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
  const activeIndex = stage === 'uploading' ? 0 : stage === 'processing' ? 1 : -1;

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight">Upload a contract</h1>
        <p className="mt-2 text-[var(--muted)]">
          PDF or DOCX, up to 10MB. Each clause will be identified, classified, and summarized
          in plain English.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all ${
              dragging
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--border)] hover:border-[var(--muted)] hover:bg-[var(--surface-muted)]'
            } ${busy ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              disabled={busy}
              className="sr-only"
            />

            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-9 w-9 text-[var(--muted)]"
              aria-hidden="true"
            >
              <path
                d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {file ? (
              <>
                <p className="mt-4 font-medium">{file.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {formatSize(file.size)} · click to replace
                </p>
              </>
            ) : (
              <>
                <p className="mt-4 font-medium">Drop your contract here</p>
                <p className="mt-1 text-sm text-[var(--muted)]">or click to browse</p>
              </>
            )}
          </label>

          {busy && (
            <div className="animate-fade flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              {STEPS.map((step, i) => {
                const done = activeIndex > i;
                const active = activeIndex === i;
                return (
                  <div key={step.key} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-colors ${
                        done
                          ? 'bg-emerald-500 text-white'
                          : active
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--surface-muted)] text-[var(--muted)]'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span className={active ? 'font-medium' : 'text-[var(--muted)]'}>
                      {step.label}
                    </span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 animate-ping rounded-full bg-[var(--accent)]" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <p className="animate-fade rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!file || busy}
            className="rounded-lg bg-[var(--foreground)] px-4 py-3 text-sm font-medium text-[var(--background)] transition-all hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Working…' : 'Upload and summarize'}
          </button>
        </form>
      </div>
    </div>
  );
}
