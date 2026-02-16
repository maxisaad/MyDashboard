import React from 'react';
import { DailyMetrics } from '../types';
import { Flame, Footprints, Timer } from 'lucide-react';

interface ActivityRingsProps {
  metrics: DailyMetrics;
}

const ActivityRings: React.FC<ActivityRingsProps> = ({ metrics }) => {
  return (
    <div className="w-full bg-card rounded-xl border border-white/5 p-4 flex flex-col justify-between h-40 md:h-auto">
      <div className="text-xs font-mono text-text-secondary uppercase mb-4">Daily Summary</div>
      
      <div className="flex justify-between items-end px-2">
        
        {/* Calories */}
        <div className="flex flex-col items-center gap-2">
          <div className="p-2.5 rounded-full bg-red-500/10 text-red-500">
             <Flame size={20} />
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-white leading-none">{metrics.calories}</div>
            <div className="text-[10px] text-text-secondary uppercase mt-1">Kcal</div>
          </div>
        </div>

        {/* Active Time */}
        <div className="flex flex-col items-center gap-2">
           <div className="p-2.5 rounded-full bg-lime-400/10 text-lime-400">
             <Timer size={20} />
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-white leading-none">{metrics.activeMinutes}</div>
            <div className="text-[10px] text-text-secondary uppercase mt-1">Mins</div>
          </div>
        </div>

        {/* Steps */}
        <div className="flex flex-col items-center gap-2">
           <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-500">
             <Footprints size={20} />
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-white leading-none">{metrics.steps.toLocaleString()}</div>
            <div className="text-[10px] text-text-secondary uppercase mt-1">Steps</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ActivityRings;