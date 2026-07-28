'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { Clause } from '@/lib/api';

const CLAUSE_TYPE_LABELS: Record<string, string> = {
  payment: 'Payment',
  termination: 'Termination',
  confidentiality: 'Confidentiality',
  renewal: 'Renewal',
  duration: 'Duration',
  other: 'Other',
};

const COLORS: Record<string, string> = {
  Payment: '#10b981',
  Termination: '#f43f5e',
  Confidentiality: '#3b82f6',
  Renewal: '#8b5cf6',
  Duration: '#f59e0b',
  Other: '#94a3b8',
};

export default function ClauseTypeChart({ clauses }: { clauses: Clause[] }) {
  const counts = new Map<string, number>();
  for (const clause of clauses) {
    const label = CLAUSE_TYPE_LABELS[clause.clause_type] ?? clause.clause_type;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const data = Array.from(counts, ([type, count]) => ({ type, count })).sort(
    (a, b) => b.count - a.count
  );

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="type"
            width={110}
            tick={{ fontSize: 12, fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-muted)' }}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 13,
            }}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} animationDuration={900}>
            {data.map((entry) => (
              <Cell key={entry.type} fill={COLORS[entry.type] ?? COLORS.Other} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
