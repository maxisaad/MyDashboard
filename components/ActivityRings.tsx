import React from 'react';
import { WeeklySummary } from '../services/metrics';

interface SummaryCardProps {
  thisWeek: WeeklySummary;
  thisMonth: WeeklySummary;
  lastMonth: WeeklySummary;
  thisYear: WeeklySummary;
  lastYear: WeeklySummary;
}

const SummaryRow: React.FC<{ summary: WeeklySummary; label: string }> = ({ summary, label }) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
    <div className="text-[10px] font-mono text-text-secondary uppercase w-20 flex-shrink-0">{label}</div>
    <div className="flex gap-4 flex-1">
      <div className="flex flex-col items-center flex-1">
        <span className="text-[9px] text-text-secondary uppercase">Run</span>
        <span className="text-sm font-mono font-medium text-lime-400">{summary.runDistanceKm} km</span>
      </div>
      <div className="flex flex-col items-center flex-1">
        <span className="text-[9px] text-text-secondary uppercase">Bike</span>
        <span className="text-sm font-mono font-medium text-cyan-400">{summary.bikeDistanceKm} km</span>
      </div>
      <div className="flex flex-col items-center flex-1">
        <span className="text-[9px] text-text-secondary uppercase">Duration</span>
        <span className="text-sm font-mono font-medium">{summary.totalDuration}</span>
      </div>
    </div>
  </div>
);

const SummaryCard: React.FC<SummaryCardProps> = ({ thisWeek, thisMonth, lastMonth, thisYear, lastYear }) => {
  return (
    <div className="w-full bg-card rounded-xl border border-white/5 p-4 flex flex-col h-full min-h-[180px]">
      <div className="text-xs font-mono text-text-secondary uppercase mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-blurple"></span>
        Summary
      </div>
      <div className="flex-1 overflow-y-auto">
        <SummaryRow summary={thisWeek} label="This week" />
        <SummaryRow summary={thisMonth} label="This month" />
        <SummaryRow summary={lastMonth} label="Last month" />
        <SummaryRow summary={thisYear} label="This year" />
        <SummaryRow summary={lastYear} label="Last year" />
      </div>
    </div>
  );
};

export default SummaryCard;
