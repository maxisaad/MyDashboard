import React from 'react';
import { DailyMetrics } from '../types';
import { WeeklySummary } from '../services/metrics';
import { Flame, Bike, Timer, Footprints, Mountain } from 'lucide-react';

interface ActivityRingsProps {
  metrics: DailyMetrics;
  weekly: WeeklySummary;
  prevWeekly: WeeklySummary;
  selectedDate?: Date;
}

const WeeklyRow: React.FC<{ summary: WeeklySummary; label: string }> = ({ summary, label }) => (
  <div>
    <div className="text-[10px] font-mono text-text-secondary uppercase mb-2">{label}</div>
    <div className="grid grid-cols-3 gap-2">
      <div className="flex flex-col">
        <span className="text-[9px] text-text-secondary uppercase">Run</span>
        <span className="text-sm font-mono font-medium text-lime-400">{summary.runDistanceKm} km</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] text-text-secondary uppercase">Bike</span>
        <span className="text-sm font-mono font-medium text-cyan-400">{summary.bikeDistanceKm} km</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] text-text-secondary uppercase">Duration</span>
        <span className="text-sm font-mono font-medium">{summary.totalDuration}</span>
      </div>
    </div>
  </div>
);

const ActivityRings: React.FC<ActivityRingsProps> = ({ metrics, weekly, prevWeekly, selectedDate }) => {
  const dateLabel = selectedDate
    ? selectedDate.toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';

  return (
    <div className="w-full bg-card rounded-xl border border-white/5 p-4 flex flex-col justify-between gap-6 h-full min-h-[180px]">

      {/* Daily Summary */}
      <div>
        <div className="flex justify-between items-center mb-3">
            <div className="text-xs font-mono text-text-secondary uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green"></span>
                Daily Summary
            </div>
            <div className="text-xs font-mono text-white">
                {dateLabel}
            </div>
        </div>

        <div className="flex justify-between items-end px-2">
            <div className="flex flex-col items-center gap-2">
            <div className="p-2 rounded-full bg-red-500/10 text-red-500">
                <Flame size={18} />
            </div>
            <div className="text-center">
                <div className="text-lg font-bold text-white leading-none">{metrics.calories}</div>
                <div className="text-[9px] text-text-secondary uppercase mt-0.5">Kcal</div>
            </div>
            </div>

            <div className="flex flex-col items-center gap-2">
            <div className="p-2 rounded-full bg-lime-400/10 text-lime-400">
                <Timer size={18} />
            </div>
            <div className="text-center">
                <div className="text-lg font-bold text-white leading-none">
                  {metrics.activeMinutes >= 60
                    ? `${Math.floor(metrics.activeMinutes / 60)}h${metrics.activeMinutes % 60 > 0 ? ` ${metrics.activeMinutes % 60}m` : ''}`
                    : `${metrics.activeMinutes}m`}
                </div>
                <div className="text-[9px] text-text-secondary uppercase mt-0.5">Active</div>
            </div>
            </div>

            <div className="flex flex-col items-center gap-2">
            <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
                <Footprints size={18} />
            </div>
            <div className="text-center">
                <div className="text-lg font-bold text-white leading-none">
                  {metrics.steps > 0 ? metrics.steps.toLocaleString() : '—'}
                </div>
                <div className="text-[9px] text-text-secondary uppercase mt-0.5">Steps</div>
            </div>
            </div>
        </div>
      </div>

      <div className="h-px bg-white/5 w-full"></div>

      {/* Weekly Summaries */}
      <div className="space-y-4">
        <WeeklyRow summary={weekly} label="This Week" />
        <WeeklyRow summary={prevWeekly} label="Last Week" />
      </div>

    </div>
  );
};

export default ActivityRings;
