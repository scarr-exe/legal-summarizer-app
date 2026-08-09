'use client';

import { useState } from 'react';
import { submitEvaluation, ApiError } from '@/lib/api';

/**
 * Collects the usability/comprehension rating Chapter 5's evaluation is
 * built from, at the point where a participant has just read a summary
 * and has an opinion — rather than via a separate survey afterwards.
 *
 * The backend enforces one rating per user per document and upserts on
 * repeat submission, so "Change rating" re-POSTs rather than needing a
 * separate update endpoint.
 */

const LABELS: Record<number, string> = {
  1: 'Not clear at all',
  2: 'Slightly clearer',
  3: 'Somewhat clearer',
  4: 'Much clearer',
  5: 'Completely clear',
};

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path
        d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.78l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function EvaluationWidget({
  documentId,
  initialRating,
  initialComments,
  getValidAccessToken,
}: {
  documentId: number;
  initialRating: number | null;
  initialComments: string;
  getValidAccessToken: () => Promise<string>;
}) {
  const [saved, setSaved] = useState<number | null>(initialRating);
  const [editing, setEditing] = useState(initialRating === null);
  const [rating, setRating] = useState(initialRating ?? 0);
  const [hover, setHover] = useState(0);
  const [comments, setComments] = useState(initialComments);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!rating) return;
    setPending(true);
    setError(null);
    try {
      const token = await getValidAccessToken();
      await submitEvaluation(documentId, rating, comments, token);
      setSaved(rating);
      setEditing(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not save your rating. Try again.'
      );
    } finally {
      setPending(false);
    }
  }

  // Filled state follows the pointer while hovering so the control reads
  // as interactive before a choice is committed.
  const shown = hover || rating;

  if (!editing && saved !== null) {
    return (
      <div
        className="card card-glow p-6"
        style={{ ['--card-glow' as string]: 'rgba(45,212,191,0.14)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Thanks for the feedback.</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              You rated this summary {saved}/5 — {LABELS[saved]}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex text-[var(--accent)]" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} filled={n <= saved} />
              ))}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:border-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Change
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="card card-glow p-6"
      style={{ ['--card-glow' as string]: 'rgba(251,191,36,0.14)' }}
    >
      <h2 className="text-xl font-semibold tracking-tight">
        How clear were these summaries?
      </h2>
      <p className="mt-1.5 text-sm text-[var(--muted)]">
        Compared with reading the original contract. Your answer feeds the project&apos;s
        evaluation.
      </p>

      <div
        className="mt-5 flex items-center gap-3"
        role="radiogroup"
        aria-label="Clarity rating out of 5"
        onMouseLeave={() => setHover(0)}
      >
        <div className="flex text-[var(--accent)]">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} out of 5 — ${LABELS[n]}`}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              onClick={() => setRating(n)}
              className="rounded transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <Star filled={n <= shown} />
            </button>
          ))}
        </div>
        <span className="text-sm text-[var(--muted)]">
          {shown ? LABELS[shown] : 'Select a rating'}
        </span>
      </div>

      {/* Comments only appear once a rating is chosen — an empty textarea
          up front makes the widget look like a chore. */}
      {rating > 0 && (
        <div className="animate-fade mt-5">
          <label
            htmlFor="evaluation-comments"
            className="text-sm font-medium text-[var(--muted)]"
          >
            Anything to add? <span className="font-normal">(optional)</span>
          </label>
          <textarea
            id="evaluation-comments"
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="What helped, or what was still confusing?"
            className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
          />
        </div>
      )}

      {error && (
        <p className="animate-fade mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={!rating || pending}
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#1a1200] transition-all hover:opacity-90 disabled:opacity-40"
        >
          {pending ? 'Saving…' : saved !== null ? 'Update rating' : 'Submit rating'}
        </button>
        {saved !== null && (
          <button
            onClick={() => {
              setEditing(false);
              setRating(saved);
              setError(null);
            }}
            className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
