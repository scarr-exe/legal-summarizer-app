'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { user, isLoading } = useAuth();

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
        Understand your contracts in plain language.
      </h1>
      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Upload a tenancy agreement, employment contract, or NDA and get each clause
        identified, classified, and summarized in plain English.
      </p>

      {!isLoading && (
        <div className="flex gap-4">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-zinc-300 px-5 py-2.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
