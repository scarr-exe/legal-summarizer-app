'use client';

import { useEffect, useState } from 'react';
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
 * Below `md` the links collapse into a slide-in drawer. On a phone the
 * inline version ran out of room and wrapped "Log out" onto two lines,
 * which matters here because most evaluation participants are on mobile.
 *
 * The drawer stays mounted and animates via transform/opacity rather than
 * being conditionally rendered, so it animates on the way *out* as well as
 * in — unmounting on close would make it vanish instantly.
 */
export default function NavBar() {
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on navigation, otherwise the drawer stays open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape to dismiss, and lock body scroll so the page behind doesn't
  // scroll under the drawer on touch devices.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const desktopTab = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={`relative px-1 py-4 text-sm transition-colors ${
        isActive(href)
          ? 'text-[var(--foreground)]'
          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
      }`}
    >
      {label}
      {isActive(href) && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />
      )}
    </Link>
  );

  const drawerLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={`rounded-xl px-4 py-3 text-base transition-colors ${
        isActive(href)
          ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
          : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center gap-8 px-5 sm:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 py-4 transition-opacity hover:opacity-80"
          >
            <Logo className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight">Clarity</span>
          </Link>

          {user && !isLoading && (
            <div className="hidden items-center gap-6 md:flex">
              {desktopTab('/dashboard', 'Dashboard')}
              {desktopTab('/upload', 'Upload')}
            </div>
          )}

          <div className="ml-auto flex items-center gap-3 text-sm">
            {isLoading ? (
              <div className="h-8 w-28 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
            ) : user ? (
              <>
                <span className="hidden text-[var(--muted)] md:block">{user.username}</span>
                <button
                  onClick={logout}
                  className="hidden rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-[var(--muted)] transition-colors hover:border-[var(--muted)] hover:text-[var(--foreground)] md:block"
                >
                  Log out
                </button>
                <HamburgerButton open={open} onClick={() => setOpen((v) => !v)} />
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
                  className="whitespace-nowrap rounded-lg bg-[var(--accent)] px-4 py-1.5 font-medium text-[#1a1200] transition-opacity hover:opacity-90"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Drawer, signed-in on small screens only. */}
      {user && !isLoading && (
        <div className="md:hidden">
          <div
            onClick={() => setOpen(false)}
            aria-hidden
            className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
              open ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          />

          <aside
            id="mobile-nav"
            aria-hidden={!open}
            className={`fixed right-0 top-0 z-50 flex h-dvh w-[min(19rem,82vw)] flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              open ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Logo className="h-6 w-6" />
                <span className="font-semibold tracking-tight">Clarity</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 p-4">
              {drawerLink('/dashboard', 'Dashboard')}
              {drawerLink('/upload', 'Upload')}
            </nav>

            <div className="border-t border-[var(--border)] p-4">
              <p className="px-1 pb-3 text-xs text-[var(--muted)]">
                Signed in as{' '}
                <span className="font-medium text-[var(--foreground)]">{user.username}</span>
              </p>
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-base text-[var(--muted)] transition-colors hover:border-rose-400 hover:text-rose-500"
              >
                Log out
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/** Three bars that morph into an X. The middle bar fades while the outer
 * two rotate into place, which reads as one continuous motion. */
function HamburgerButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const bar =
    'absolute left-1/2 h-[1.6px] w-5 -translate-x-1/2 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none';

  return (
    <button
      onClick={onClick}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      aria-controls="mobile-nav"
      className="relative -mr-1 h-10 w-10 rounded-lg text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] md:hidden"
    >
      <span className={`${bar} ${open ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-[13px]'}`} />
      <span className={`${bar} top-1/2 -translate-y-1/2 ${open ? 'opacity-0' : 'opacity-100'}`} />
      <span
        className={`${bar} ${open ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'top-[25px]'}`}
      />
    </button>
  );
}
