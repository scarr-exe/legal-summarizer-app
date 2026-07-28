import type { DocumentSummary } from '@/lib/api';

const STYLES: Record<DocumentSummary['status'], string> = {
  uploaded: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  processing: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  complete: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

const LABELS: Record<DocumentSummary['status'], string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  complete: 'Complete',
  failed: 'Failed',
};

export default function StatusBadge({ status }: { status: DocumentSummary['status'] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
