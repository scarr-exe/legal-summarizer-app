export default function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path
        d="M10 9.5h8.5L23 14v8.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 22.5v-11A1.5 1.5 0 0 1 10.5 9.5Z"
        fill="white"
        fillOpacity="0.16"
      />
      <path
        d="M12.5 15.5h7M12.5 18.5h7M12.5 21h4.5"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M18.5 9.5 23 14h-3a1.5 1.5 0 0 1-1.5-1.5V9.5Z"
        fill="white"
        fillOpacity="0.55"
      />
    </svg>
  );
}
