'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Logo from './Logo';

/**
 * Unified from the two redesign mockups, which showed different navbars:
 * one a floating rounded pill, the other a full-width bar with underlined
 * tabs. Taking the full-width bar with the underline indicator, because
 * the underline marks the active route (the pill version had no active
 * state at all) and a full-width bar aligns with the page gutters.
 *
 * Two things from the mockups deliberately dropped:
 *   - The duplicate "Upload": one mockup had Upload as both a nav tab and
 *     a primary button in the same bar. Kept as a tab only; the dashboard
 *     already carries the primary "Upload document" call to action.
 *   - The username dropdown chevron: it implied a menu whose only item
 *     would have been Log out, which already sits beside it as a button.
 */
export default function NavBar() {
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();

  const tab = (href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        className={`relative px-1 py-4 text-sm transition-colors ${
          active
            ? 'text-[var(--foreground)]'
            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
        }`}
      >
        {label}
        {active && (
          <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />
        )}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center gap-8 px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 py-4 transition-opacity hover:opacity-80"
        >
          <Logo className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight">Clarity</span>
        </Link>

        {user && !isLoading && (
          <div className="flex items-center gap-6">
            {tab('/dashboard', 'Dashboard')}
            {tab('/upload', 'Upload')}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3 text-sm">
          {isLoading ? (
            <div className="h-8 w-36 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
          ) : user ? (
            <>
              <span className="hidden text-[var(--muted)] sm:block">{user.username}</span>
              <button
                onClick={logout}
                className="rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-[var(--muted)] transition-colors hover:border-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-2 py-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-[var(--accent)] px-4 py-1.5 font-medium text-[#1a1200] transition-opacity hover:opacity-90"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
