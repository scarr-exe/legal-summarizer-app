import Link from 'next/link';
import Logo from './Logo';

/** Shared frame for the login and register pages. */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-[calc(100vh-61px)] items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="blob left-1/2 top-0 h-72 w-72 -translate-x-1/2"
          style={{ background: 'var(--accent)' }}
        />
      </div>

      <div className="animate-rise w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Logo className="mx-auto h-10 w-10" />
          </Link>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl shadow-black/5 dark:shadow-black/30">
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">{footer}</p>
      </div>
    </div>
  );
}
