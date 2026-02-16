import React from 'react';
import { DailyMetrics } from '../types';
import { Flame, Footprints, Timer, TrendingUp } from 'lucide-react';

interface ActivityRingsProps {
  metrics: DailyMetrics;
}

const ActivityRings: React.FC<ActivityRingsProps> = ({ metrics }) => {
  return (
    <div className="w-full bg-card rounded-xl border border-white/5 p-4 flex flex-col justify-between gap-6 h-full min-h-[180px]">
      
      {/* Section 1: Daily Summary */}
      <div>
        <div className="text-xs font-mono text-text-secondary uppercase mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green"></span>
            Daily Summary
        </div>
        
        <div className="flex justify-between items-end px-2">
            {/* Calories */}
            <div className="flex flex-col items-center gap-2">
            <div className="p-2 rounded-full bg-red-500/10 text-red-500">
                <Flame size={18} />
            </div>
            <div className="text-center">
                <div className="text-lg font-bold text-white leading-none">{metrics.calories}</div>
                <div className="text-[9px] text-text-secondary uppercase mt-0.5">Kcal</div>
            </div>
            </div>

            {/* Active Time */}
            <div className="flex flex-col items-center gap-2">
            <div className="p-2 rounded-full bg-lime-400/10 text-lime-400">
                <Timer size={18} />
            </div>
            <div className="text-center">
                <div className="text-lg font-bold text-white leading-none">{metrics.activeMinutes}</div>
                <div className="text-[9px] text-text-secondary uppercase mt-0.5">Mins</div>
            </div>
            </div>

            {/* Steps */}
            <div className="flex flex-col items-center gap-2">
            <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
                <Footprints size={18} />
            </div>
            <div className="text-center">
                <div className="text-lg font-bold text-white leading-none">{metrics.steps.toLocaleString()}</div>
                <div className="text-[9px] text-text-secondary uppercase mt-0.5">Steps</div>
            </div>
            </div>
        </div>
      </div>

      <div className="h-px bg-white/5 w-full"></div>

      {/* Section 2: Weekly Summary (Mocked for Demo) */}
      <div>
        <div className="text-xs font-mono text-text-secondary uppercase mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-blurple"></span>
            Weekly Summary
        </div>
        
        <div className="flex justify-between px-2">
            <div className="flex flex-col">
                <span className="text-[9px] text-text-secondary uppercase">Distance</span>
                <span className="text-sm font-mono font-medium">42.5 km</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] text-text-secondary uppercase">Duration</span>
                <span className="text-sm font-mono font-medium">4h 20m</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] text-text-secondary uppercase">Load</span>
                <span className="text-sm font-mono font-medium text-accent-green">340</span>
            </div>
        </div>
      </div>

    </div>
  );
};

export default ActivityRings;