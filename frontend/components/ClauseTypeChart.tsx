'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Clause } from '@/lib/api';

const CLAUSE_TYPE_LABELS: Record<Clause['clause_type'], string> = {
  payment: 'Payment',
  termination: 'Termination',
  confidentiality: 'Confidentiality',
  renewal: 'Renewal',
  other: 'Other',
};

export default function ClauseTypeChart({ clauses }: { clauses: Clause[] }) {
  const counts = new Map<string, number>();
  for (const clause of clauses) {
    const label = CLAUSE_TYPE_LABELS[clause.clause_type] ?? clause.clause_type;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const data = Array.from(counts, ([type, count]) => ({ type, count }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="type" width={110} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#3f3f46" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
