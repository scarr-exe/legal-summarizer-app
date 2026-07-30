'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Rectangle,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import type { Clause } from '@/lib/api';
import { labelFor, colorFor, typePriority } from '@/lib/clause-types';

interface Row {
  type: string;
  label: string;
  count: number;
  color: string;
  share: number;
}

function buildRows(clauses: Clause[]): Row[] {
  const counts = new Map<string, number>();
  for (const clause of clauses) {
    counts.set(clause.clause_type, (counts.get(clause.clause_type) ?? 0) + 1);
  }

  return Array.from(counts, ([type, count]) => ({
    type,
    label: labelFor(type),
    count,
    color: colorFor(type),
    share: clauses.length ? Math.round((count / clauses.length) * 100) : 0,
  })).sort((a, b) => {
    // 'other' always sinks to the bottom; the rest rank by frequency.
    const aOther = typePriority(a.type) >= 99 ? 1 : 0;
    const bOther = typePriority(b.type) >= 99 ? 1 : 0;
    return aOther !== bOther ? aOther - bOther : b.count - a.count;
  });
}

export default function ClauseTypeChart({ clauses }: { clauses: Clause[] }) {
  const data = buildRows(clauses);
  const identified = clauses.filter((c) => c.clause_type !== 'other').length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <span className="text-2xl font-semibold tabular-nums">{clauses.length}</span>
          <span className="ml-1.5 text-sm text-[var(--muted)]">clauses</span>
        </div>
        <div>
          <span className="text-2xl font-semibold tabular-nums">{identified}</span>
          <span className="ml-1.5 text-sm text-[var(--muted)]">identified by type</span>
        </div>
        <div>
          <span className="text-2xl font-semibold tabular-nums">{data.length}</span>
          <span className="ml-1.5 text-sm text-[var(--muted)]">
            {data.length === 1 ? 'category' : 'categories'}
          </span>
        </div>
      </div>

      <div style={{ height: Math.max(data.length * 46 + 16, 120) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 44, top: 0, bottom: 0 }}
            barCategoryGap={10}
          >
            {/* Axes carry no ticks/lines — the value labels on each bar
                communicate the numbers, so gridlines would be noise. */}
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={124}
              tick={{ fontSize: 13, fill: 'var(--muted)' }}
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
                color: 'var(--foreground)',
              }}
              formatter={(value, _name, item) => {
                const count = Number(value);
                const share = (item?.payload as Row | undefined)?.share ?? 0;
                return [`${count} clause${count === 1 ? '' : 's'} · ${share}%`, 'Count'];
              }}
            />
            <Bar
              dataKey="count"
              animationDuration={800}
              barSize={22}
              // Cell is deprecated in Recharts 3 (removed in 4); per-datum
              // colour goes through `shape` now.
              shape={(props) => (
                <Rectangle
                  {...props}
                  radius={[0, 6, 6, 0]}
                  fill={colorFor((props.payload as Row).type)}
                />
              )}
            >
              <LabelList
                dataKey="count"
                position="right"
                offset={10}
                style={{ fill: 'var(--muted)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}