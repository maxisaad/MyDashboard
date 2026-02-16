import React, { useState } from 'react';
import { Activity, SportType } from '../types';
import { MapPin, Zap, Filter } from 'lucide-react';

interface ActivityListProps {
  activities: Activity[];
}

const ActivityList: React.FC<ActivityListProps> = ({ activities }) => {
  const [filter, setFilter] = useState<SportType | 'All'>('All');

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(2) + ' km';
  };

  const getSportColor = (type: SportType) => {
    switch (type) {
        case SportType.Run: return 'text-lime-400';
        case SportType.Ride: return 'text-cyan-400';
        case SportType.Swim: return 'text-blue-400';
        case SportType.WeightTraining: return 'text-red-400';
        default: return 'text-white';
    }
  };

  const filteredActivities = filter === 'All' 
    ? activities 
    : activities.filter(a => a.sport_type === filter);

  return (
    <div className="mt-6 pb-24 md:pb-0">
      
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
          <div className="text-xs font-mono text-text-secondary px-1 uppercase">Recent Activities</div>
          
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <button 
                onClick={() => setFilter('All')}
                className={`px-3 py-1 rounded-full text-[10px] font-medium border transition-colors whitespace-nowrap ${filter === 'All' ? 'bg-white text-black border-white' : 'bg-transparent text-text-secondary border-white/10 hover:border-white/30'}`}
            >
                ALL
            </button>
            {Object.values(SportType).map(type => (
                <button 
                    key={type}
                    onClick={() => setFilter(type)}
                    className={`px-3 py-1 rounded-full text-[10px] font-medium border transition-colors whitespace-nowrap ${filter === type ? 'bg-white text-black border-white' : 'bg-transparent text-text-secondary border-white/10 hover:border-white/30'}`}
                >
                    {type.toUpperCase()}
                </button>
            ))}
          </div>
      </div>

      <div className="space-y-2">
        {filteredActivities.map((activity) => (
          <div 
            key={activity.id} 
            className="bg-card hover:bg-white/10 transition-colors rounded-xl border border-white/5 p-4 flex flex-col gap-3"
          >
            {/* Top Row: Icon, Type, Location, Date */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/5 ${getSportColor(activity.sport_type)}`}>
                    <Zap size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">{activity.sport_type}</h3>
                  <div className="flex items-center gap-1 text-xs text-text-secondary">
                    <MapPin size={10} />
                    {activity.location_label}
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-text-secondary">
                {new Date(activity.start_date).toLocaleDateString()}
              </span>
            </div>

            {/* Bottom Row: 4 Columns (Time, Dist, Elev, Load) */}
            <div className="grid grid-cols-4 gap-2 border-t border-white/5 pt-3">
               
               {/* Time */}
               <div className="flex flex-col">
                 <span className="text-[9px] text-text-secondary uppercase mb-0.5">Time</span>
                 <span className="text-sm font-mono font-medium">{formatDuration(activity.duration)}</span>
               </div>
               
               {/* Distance */}
               <div className="flex flex-col">
                 <span className="text-[9px] text-text-secondary uppercase mb-0.5">Dist</span>
                 <span className="text-sm font-mono font-medium">{formatDistance(activity.distance)}</span>
               </div>
               
               {/* Elevation */}
               <div className="flex flex-col">
                 <span className="text-[9px] text-text-secondary uppercase mb-0.5">Elev</span>
                 <span className="text-sm font-mono font-medium">{activity.elevation_gain} <span className="text-[10px] text-text-secondary">m</span></span>
               </div>

               {/* Load */}
               <div className="flex flex-col">
                 <span className="text-[9px] text-text-secondary uppercase mb-0.5">Load</span>
                 <div className="flex items-center gap-1">
                    <span className="text-sm font-mono font-medium text-accent-blurple">{activity.training_load || '-'}</span>
                 </div>
               </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityList;