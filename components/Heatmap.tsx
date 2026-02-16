import React from 'react';
import { Activity, SportType } from '../types';

interface HeatmapProps {
    activities: Activity[];
}

const Heatmap: React.FC<HeatmapProps> = ({ activities }) => {
  // Generate last 21 days (3 weeks)
  const weeks = [2, 1, 0].map(weekOffset => {
      return Array.from({ length: 7 }, (_, dayIndex) => {
          const d = new Date();
          // Adjust to get blocks of 7 days ending today
          const daysToSubtract = (weekOffset * 7) + (6 - dayIndex);
          d.setDate(d.getDate() - daysToSubtract);
          return d;
      });
  });

  const getDayActivity = (date: Date) => {
      return activities.find(a => {
          const aDate = new Date(a.start_date);
          return aDate.getDate() === date.getDate() && 
                 aDate.getMonth() === date.getMonth() && 
                 aDate.getFullYear() === date.getFullYear();
      });
  }

  // Get color based on the sport type of the activity on that day
  const getColor = (activity?: Activity) => {
    if (!activity) return 'bg-white/5';

    switch (activity.sport_type) {
        case SportType.Run: return 'bg-lime-400';
        case SportType.Ride: return 'bg-cyan-400';
        case SportType.Swim: return 'bg-blue-400';
        case SportType.WeightTraining: return 'bg-red-400';
        case SportType.Hike: return 'bg-amber-400';
        default: return 'bg-white/20';
    }
  };

  return (
    <div className="w-full bg-card rounded-xl border border-white/5 p-4 flex flex-col justify-between gap-4 h-full min-h-[180px]">
      <div className="flex justify-between items-center">
          <div className="text-xs font-mono text-text-secondary uppercase">Weekly Analysis</div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-lime-400 rounded-sm"></div><span className="text-[9px] text-text-secondary">Run</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-cyan-400 rounded-sm"></div><span className="text-[9px] text-text-secondary">Ride</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-400 rounded-sm"></div><span className="text-[9px] text-text-secondary">Gym</span></div>
          </div>
      </div>
      
      <div className="flex flex-col gap-2 h-full justify-center">
        {weeks.map((week, wIndex) => (
            <div key={wIndex} className="flex justify-between gap-2">
                {week.map((day, dIndex) => {
                    const activity = getDayActivity(day);
                    return (
                        <div key={dIndex} className="flex-1 aspect-square relative group">
                            <div 
                                className={`w-full h-full rounded-sm transition-colors ${getColor(activity)}`}
                            ></div>
                            {/* Tooltip on hover */}
                            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black border border-white/10 text-[10px] text-white rounded whitespace-nowrap z-10 pointer-events-none">
                                <div className="font-bold">{day.toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                                {activity && <div className="text-accent-green">{activity.sport_type} • {Math.round(activity.distance/1000)}km</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        ))}
      </div>
      
      <div className="flex justify-between mt-1 px-0.5 border-t border-white/5 pt-2">
          <span className="text-[9px] text-text-secondary font-mono">2 Weeks Ago</span>
          <span className="text-[9px] text-text-secondary font-mono">This Week</span>
      </div>
    </div>
  );
};

export default Heatmap;