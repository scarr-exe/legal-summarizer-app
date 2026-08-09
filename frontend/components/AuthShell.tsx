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
    <div className="relative flex min-h-[calc(100dvh-61px)] items-center justify-center px-5 py-10 sm:px-6 sm:py-16">
      <div className="ambient -z-10" aria-hidden />

      <div className="animate-rise w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Logo className="mx-auto h-10 w-10" />
          </Link>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
        </div>

        <div
          className="card card-glow p-6"
          style={{ ['--card-glow' as string]: 'rgba(251,191,36,0.14)' }}
        >
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">{footer}</p>
      </div>
    </div>
  );
}
