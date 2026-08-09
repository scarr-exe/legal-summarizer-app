import type { DocumentSummary } from '@/lib/api';

/**
 * The dashboard mockup rendered every row as a green "Analyzed" pill.
 * The label is an improvement on "Complete" -- it says what actually
 * happened to the document -- so it is adopted here. Painting every
 * status green is not: `processing` and `failed` are real states the
 * backend returns, and a user whose upload failed needs to see that
 * rather than a green badge claiming success. Each status keeps its own
 * colour.
 */

const STYLES: Record<DocumentSummary['status'], string> = {
  uploaded: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  processing: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  complete: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

const LABELS: Record<DocumentSummary['status'], string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  complete: 'Analyzed',
  failed: 'Failed',
};

export default function StatusBadge({ status }: { status: DocumentSummary['status'] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status]}
    </span>
  );
}
