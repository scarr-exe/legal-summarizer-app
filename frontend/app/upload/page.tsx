'use client';

import { useState, FormEvent, ChangeEvent, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth-context';
import { uploadDocument, processDocument, ApiError } from '@/lib/api';

type Stage = 'idle' | 'extracting' | 'identifying' | 'summarizing' | 'error';

/**
 * The backend only gives us two real signals: upload() resolving (text
 * extracted) and process() resolving (clauses identified AND summarized —
 * one request, no signal in between). Clause matching is fast rule-based
 * work while summarization is the slow part, so the 'identifying' ->
 * 'summarizing' transition is a timed estimate against the still-in-flight
 * process() call, not a separate network event.
 */
const IDENTIFY_TO_SUMMARIZE_DELAY_MS = 1400;

const STAGES = [
  { key: 'extracting', label: 'Extracting text', progress: 18 },
  { key: 'identifying', label: 'Identifying clauses', progress: 55 },
  { key: 'summarizing', label: 'Summarizing', progress: 90 },
] as const satisfies readonly { key: Stage; label: string; progress: number }[];

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
    let toSummarizing: ReturnType<typeof setTimeout> | undefined;
    try {
      setStage('extracting');
      const token = await getValidAccessToken();
      const uploaded = await uploadDocument(file, token);

      setStage('identifying');
      toSummarizing = setTimeout(() => setStage('summarizing'), IDENTIFY_TO_SUMMARIZE_DELAY_MS);

      const freshToken = await getValidAccessToken();
      await processDocument(uploaded.id, freshToken);

      router.push(`/documents/${uploaded.id}`);
    } catch (err) {
      setStage('error');
      setError(err instanceof ApiError ? err.message : 'Something went wrong during processing.');
    } finally {
      clearTimeout(toSummarizing);
    }
  }

  if (authLoading || !user) return null;

  const busy = stage === 'extracting' || stage === 'identifying' || stage === 'summarizing';
  const current = STAGES.find((s) => s.key === stage);

  return (
    <div className="mx-auto max-w-xl px-5 py-10 sm:px-6 sm:py-16">
      <div className="animate-rise">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Upload a contract</h1>
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

          {busy && current && (
            <div className="animate-fade card flex flex-col gap-2.5 p-4">
              <div className="flex items-center justify-between text-sm">
                <span key={stage} className="animate-fade font-medium">
                  {current.label}
                </span>
                <span className="text-xs text-[var(--muted)]">{current.progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="relative h-full overflow-hidden rounded-full bg-[var(--accent)] transition-[width] duration-700 ease-out"
                  style={{ width: `${current.progress}%` }}
                >
                  <span className="progress-shimmer absolute inset-0" />
                </div>
              </div>
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
            className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#1a1200] transition-all hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Working…' : 'Upload and summarize'}
          </button>
        </form>
      </div>
    </div>
  );
}
