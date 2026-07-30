'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import Reveal from '@/components/Reveal';
import ClausePreview from '@/components/ClausePreview';

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
  { label: 'Payment', desc: 'What you owe, when it is due, and what happens if you are late.' },
  { label: 'Termination', desc: 'How the agreement ends and how much notice is required.' },
  { label: 'Confidentiality', desc: 'What you must keep private and for how long.' },
  { label: 'Renewal', desc: 'Whether it renews on its own, and the window to opt out.' },
  { label: 'Duration', desc: 'When the agreement starts and how long it runs.' },
  { label: 'Other', desc: 'Everything else, still segmented and summarized in order.' },
];

export default function Home() {
  const { user, isLoading } = useAuth();

  return (
    <div className="overflow-hidden">
      {/* ---------------- Hero ---------------- */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="grid-lines absolute inset-0 h-[560px]" />
          <div
            className="blob left-[10%] top-[-80px] h-80 w-80"
            style={{ background: 'var(--accent)' }}
          />
          <div
            className="blob right-[8%] top-[20px] h-72 w-72"
            style={{ background: 'var(--accent)', animationDelay: '4s' }}
          />
        </div>

        <div className="mx-auto max-w-6xl px-6 pb-20 pt-24 sm:pt-32">
          <div className="animate-rise mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              Legal documents,
              <br />
              <span className="text-[var(--muted)]">in language you understand.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[var(--muted)]">
              Upload a tenancy agreement, employment contract, or NDA. Every clause is
              identified, classified, and rewritten in plain English — with the original
              always one glance away.
            </p>

            {!isLoading && (
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                {user ? (
                  <Link
                    href="/dashboard"
                    className="rounded-xl bg-[var(--foreground)] px-6 py-3 font-medium text-[var(--background)] shadow-lg shadow-black/10 transition-transform hover:scale-[1.03] active:scale-95"
                  >
                    Go to dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/register"
                      className="rounded-xl bg-[var(--foreground)] px-6 py-3 font-medium text-[var(--background)] shadow-lg shadow-black/10 transition-transform hover:scale-[1.03] active:scale-95"
                    >
                      Summarize a document
                    </Link>
                    <Link
                      href="/login"
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3 font-medium transition-colors hover:border-[var(--muted)]"
                    >
                      Log in
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Reveal delay={120} className="mx-auto mt-16 max-w-4xl">
            <ClausePreview />
          </Reveal>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="border-t border-[var(--border)] bg-[var(--surface-muted)]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <Reveal>
            <p className="text-sm font-medium text-[var(--accent)]">How it works</p>
            <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
              Three steps from signature-ready to actually readable.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 110}>
                <div className="group h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/40 hover:shadow-xl hover:shadow-black/5">
                  <span className="font-mono text-sm text-[var(--accent)]">{step.n}</span>
                  <h3 className="mt-4 text-lg font-medium">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Clause types ---------------- */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
            <Reveal>
              <p className="text-sm font-medium text-[var(--accent)]">What gets recognised</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                The clauses that decide what you are agreeing to.
              </h2>
              <p className="mt-5 text-[var(--muted)]">
                Each clause is sorted into the category that governs it, so you can jump
                straight to the parts that carry real obligations — and see the
                distribution across the whole document at a glance.
              </p>
            </Reveal>

            <div className="grid gap-3 sm:grid-cols-2">
              {CLAUSE_TYPES.map((c, i) => (
                <Reveal key={c.label} delay={i * 70}>
                  <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]/40">
                    <p className="font-medium">{c.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{c.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section className="border-t border-[var(--border)] bg-[var(--surface-muted)]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-8 py-14 text-center">
              <div
                className="blob left-1/2 top-full h-64 w-64 -translate-x-1/2"
                style={{ background: 'var(--accent)' }}
              />
              <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
                Stop signing what you cannot read.
              </h2>
              <p className="relative mx-auto mt-4 max-w-md text-[var(--muted)]">
                Upload your first contract and see every clause explained in seconds.
              </p>
              {!isLoading && (
                <Link
                  href={user ? '/upload' : '/register'}
                  className="relative mt-8 inline-block rounded-xl bg-[var(--foreground)] px-7 py-3 font-medium text-[var(--background)] shadow-lg shadow-black/10 transition-transform hover:scale-[1.03] active:scale-95"
                >
                  {user ? 'Upload a document' : 'Get started free'}
                </Link>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-[var(--muted)] sm:flex-row">
          <p>Clarity — Legal Document Summarization System</p>
          <p>Final-year project · Iwogbe Uzochukwu</p>
        </div>
      </footer>
    </div>
  );
}
