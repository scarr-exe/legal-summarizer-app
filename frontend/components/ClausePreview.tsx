'use client';

import { useEffect, useState } from 'react';

/** A self-contained mock of the summary view, used as the landing page's
 * product visual. Cycles through sample clauses so the hero shows the
 * actual output shape rather than a stock illustration. */

const SAMPLES = [
  {
    type: 'Payment',
    tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    original:
      'The Tenant shall pay rent of NGN 500,000 per annum, due monthly in advance on the 1st day of each month, and any late payment shall attract a fee of 5% of the outstanding sum.',
    summary:
      'You pay ₦500,000 a year, split monthly and due on the 1st. Paying late adds a 5% charge.',
  },
  {
    type: 'Termination',
    tone: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
    original:
      'Either party may terminate this agreement by giving not less than thirty (30) days written notice of termination, and any material breach may result in immediate termination.',
    summary:
      'Either side can end this with 30 days written notice. A serious breach can end it immediately.',
  },
  {
    type: 'Renewal',
    tone: 'text-cyan-700 dark:text-cyan-400 bg-cyan-500/10',
    original:
      'This agreement shall automatically renew for a further period of one (1) year unless either party gives notice of non-renewal at least sixty (60) days before expiration.',
    summary:
      'This renews itself for another year automatically unless someone opts out 60 days before it ends.',
  },
];

export default function ClausePreview() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SAMPLES.length), 4200);
    return () => clearInterval(id);
  }, []);

  const sample = SAMPLES[index];

  return (
    <div className="shine relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/5 dark:shadow-black/40">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 font-mono text-xs text-[var(--muted)]">
          tenancy-agreement.pdf
        </span>
        <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          Complete
        </span>
      </div>

      <div className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
            Clause {index + 1}
          </span>
          <span
            key={`badge-${index}`}
            className={`animate-fade rounded-full px-2 py-0.5 text-[11px] font-medium ${sample.tone}`}
          >
            {sample.type}
          </span>
        </div>

        <div key={index} className="animate-rise grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Original
            </p>
            <p className="font-mono text-[12.5px] leading-relaxed text-[var(--muted)]">
              {sample.original}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3.5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--accent)]">
              Plain language
            </p>
            <p className="text-[13.5px] leading-relaxed">{sample.summary}</p>
          </div>
        </div>

        <div className="mt-5 flex gap-1.5">
          {SAMPLES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show clause ${i + 1}`}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === index ? 'w-7 bg-[var(--accent)]' : 'w-3 bg-[var(--border)]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
