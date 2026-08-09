/** Colour-coded document icon, per the dashboard mockup: PDFs read red,
 * DOCX blue, so file type is scannable down the list without a text
 * column. */
export default function FileTypeIcon({
  fileType,
  className = 'h-9 w-9',
}: {
  fileType: string;
  className?: string;
}) {
  const isPdf = fileType?.toLowerCase() === 'pdf';
  const tint = isPdf ? '#f43f5e' : '#3b82f6';
  const label = isPdf ? 'PDF' : 'DOC';

  return (
    <svg viewBox="0 0 36 36" className={className} role="img" aria-label={`${label} file`}>
      <rect x="4" y="2" width="28" height="32" rx="4" fill={tint} fillOpacity="0.14" />
      <path
        d="M22 2.5 31.5 12v20a2 2 0 0 1-2 2h-23a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2H22Z"
        stroke={tint}
        strokeOpacity="0.55"
        strokeWidth="1.4"
        fill="none"
      />
      <path d="M22 2.5 31.5 12H24a2 2 0 0 1-2-2V2.5Z" fill={tint} fillOpacity="0.4" />
      <text
        x="18"
        y="27"
        textAnchor="middle"
        fill={tint}
        style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.02em' }}
      >
        {label}
      </text>
    </svg>
  );
}
