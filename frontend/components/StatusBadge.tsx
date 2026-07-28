import type { DocumentSummary } from '@/lib/api';

const STYLES: Record<DocumentSummary['status'], string> = {
  uploaded: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  processing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  complete: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const LABELS: Record<DocumentSummary['status'], string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  complete: 'Complete',
  failed: 'Failed',
};

export default function StatusBadge({ status }: { status: DocumentSummary['status'] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status]}
    </span>
  );
}
