'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Logo from './Logo';

export default function NavBar() {
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();

  const navLink = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`relative rounded-lg px-3 py-1.5 transition-colors ${
          active
            ? 'text-[var(--foreground)]'
            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
        }`}
      >
        {label}
        {active && (
          <span className="absolute inset-x-3 -bottom-px h-px bg-[var(--accent)]" />
        )}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <Logo />
          <span className="font-semibold tracking-tight">Clarity</span>
        </Link>

        <div className="flex items-center gap-1 text-sm">
          {isLoading ? (
            <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
          ) : user ? (
            <>
              {navLink('/dashboard', 'Dashboard')}
              {navLink('/upload', 'Upload')}
              <span className="mx-2 hidden h-4 w-px bg-[var(--border)] sm:block" />
              <span className="hidden text-[var(--muted)] sm:block">{user.username}</span>
              <button
                onClick={logout}
                className="ml-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--muted)] transition-colors hover:border-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              {navLink('/login', 'Log in')}
              <Link
                href="/register"
                className="ml-1 rounded-lg bg-[var(--foreground)] px-4 py-1.5 font-medium text-[var(--background)] transition-transform hover:scale-[1.03] active:scale-95"
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
