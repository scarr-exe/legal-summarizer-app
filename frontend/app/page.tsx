'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import Reveal from '@/components/Reveal';
import ClausePreview from '@/components/ClausePreview';
import { CLAUSE_TYPE_COLORS } from '@/lib/clause-types';

const STEPS = [
  {
    n: '01',
    title: 'Upload your contract',
    body: 'Drop in a PDF or DOCX — a tenancy agreement, offer letter, or NDA. Text is extracted and cleaned automatically.',
  },
  {
    n: '02',
    title: 'Clauses get identified',
    body: 'The document is split into individual clauses and each one is classified by what it actually governs.',
  },
  {
    n: '03',
    title: 'Read it in plain English',
    body: 'Every clause is paired with a plain-language summary, side by side with the original wording.',
  },
];

const CLAUSE_TYPES = [
  { key: 'payment', label: 'Payment', desc: 'What you owe, when it is due, and what happens if you are late.' },
  { key: 'termination', label: 'Termination', desc: 'How the agreement ends and how much notice is required.' },
  { key: 'confidentiality', label: 'Confidentiality', desc: 'What you must keep private and for how long.' },
  { key: 'renewal', label: 'Renewal', desc: 'Whether it renews on its own, and the window to opt out.' },
  { key: 'duration', label: 'Duration', desc: 'When the agreement starts and how long it runs.' },
  { key: 'other', label: 'Other', desc: 'Everything else, still segmented and summarized in order.' },
];

export default function Home() {
  const { user, isLoading } = useAuth();

  return (
    <div className="overflow-hidden">
      {/* ---------------- Hero ---------------- */}
      <section className="relative">
        <div className="ambient absolute inset-0 -z-10" aria-hidden />
        <div className="grid-lines pointer-events-none absolute inset-0 -z-10 h-[620px]" aria-hidden />

        <div className="mx-auto max-w-7xl px-5 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-28">
          <div className="animate-rise mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Legal documents,
              <br />
              <span className="text-[var(--accent)]">in language you understand.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-[var(--muted)] sm:mt-7 sm:text-lg">
              Upload a tenancy agreement, employment contract, or NDA. Every clause is
              identified, classified, and rewritten in plain English — with the original
              always one glance away.
            </p>

            {!isLoading && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                {user ? (
                  <Link
                    href="/dashboard"
                    className="rounded-xl bg-[var(--accent)] px-7 py-3.5 font-semibold text-[#1a1200] transition-all hover:opacity-90 active:scale-95"
                  >
                    Go to dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/register"
                      className="rounded-xl bg-[var(--accent)] px-7 py-3.5 font-semibold text-[#1a1200] transition-all hover:opacity-90 active:scale-95"
                    >
                      Summarize a document
                    </Link>
                    <Link
                      href="/login"
                      className="rounded-xl border border-[var(--border)] px-7 py-3.5 font-medium transition-colors hover:border-[var(--muted)]"
                    >
                      Log in
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Reveal delay={120} className="mx-auto mt-14 max-w-5xl sm:mt-20">
            <div
              className="card card-glow overflow-hidden"
              style={{ ['--card-glow' as string]: 'rgba(251,191,36,0.16)' }}
            >
              <ClausePreview />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="border-t border-[var(--border)] bg-[var(--surface-muted)]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <p className="text-sm font-semibold text-[var(--accent)]">How it works</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Three steps from signature-ready to actually readable.
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 110}>
                <div className="card h-full p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/40">
                  <span className="font-mono text-sm text-[var(--accent)]">{step.n}</span>
                  <h3 className="mt-5 text-lg font-medium">{step.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[var(--muted)]">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Clause types ---------------- */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
            <Reveal>
              <p className="text-sm font-semibold text-[var(--accent)]">
                What gets recognised
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                The clauses that decide what you are agreeing to.
              </h2>
              <p className="mt-6 text-[var(--muted)]">
                Each clause is sorted into the category that governs it, so you can jump
                straight to the parts that carry real obligations — and see the
                distribution across the whole document at a glance.
              </p>
            </Reveal>

            <div className="grid gap-3 sm:grid-cols-2">
              {CLAUSE_TYPES.map((c, i) => (
                <Reveal key={c.label} delay={i * 70}>
                  <div className="card h-full p-5 transition-colors hover:border-[var(--accent)]/40">
                    <div className="flex items-center gap-2.5">
                      {/* Same colour the clause carries throughout the app,
                          so the legend here teaches the charts later. */}
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CLAUSE_TYPE_COLORS[c.key] }}
                      />
                      <p className="font-medium">{c.label}</p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                      {c.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section className="border-t border-[var(--border)] bg-[var(--surface-muted)]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <div
              className="card card-glow relative overflow-hidden px-6 py-12 text-center sm:px-8 sm:py-16"
              style={{ ['--card-glow' as string]: 'rgba(251,191,36,0.18)' }}
            >
              <div className="ambient" aria-hidden />
              <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
                Stop signing what you cannot read.
              </h2>
              <p className="relative mx-auto mt-4 max-w-md text-[var(--muted)]">
                Upload your first contract and see every clause explained in seconds.
              </p>
              {!isLoading && (
                <Link
                  href={user ? '/upload' : '/register'}
                  className="relative mt-9 inline-block rounded-xl bg-[var(--accent)] px-8 py-3.5 font-semibold text-[#1a1200] transition-all hover:opacity-90 active:scale-95"
                >
                  {user ? 'Upload a document' : 'Get started free'}
                </Link>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-10 text-center text-sm text-[var(--muted)] sm:flex-row sm:px-6 sm:text-left">
          <p>Clarity — Legal Document Summarization System</p>
          <p>Final-year project · Iwogbe Uzochukwu</p>
        </div>
      </footer>
    </div>
  );
}
