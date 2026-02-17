import React, { useState, useMemo } from 'react';
import { Activity, SportType } from '../types';
import { MapPin, Filter, SlidersHorizontal, Footprints, Bike, Waves, Dumbbell, Mountain, Zap, Calendar, Search } from 'lucide-react';

interface ActivityListProps {
  activities: Activity[];
}

const ActivityList: React.FC<ActivityListProps> = ({ activities }) => {
  const [sportFilter, setSportFilter] = useState<SportType | 'All'>('All');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Advanced Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minDist, setMinDist] = useState<string>('');
  const [maxDist, setMaxDist] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Pagination State
  const [displayCount, setDisplayCount] = useState<number>(20);

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

  const getSportIcon = (type: SportType) => {
    switch (type) {
        case SportType.Run: return <Footprints size={18} />;
        case SportType.Ride: return <Bike size={18} />;
        case SportType.Swim: return <Waves size={18} />;
        case SportType.WeightTraining: return <Dumbbell size={18} />;
        case SportType.Hike: return <Mountain size={18} />;
        default: return <Zap size={18} />;
    }
  };

  // Filter Logic
  const filteredActivities = useMemo(() => {
    let result = activities;

    // 1. Sport Type Filter
    if (sportFilter !== 'All') {
        result = result.filter(a => a.sport_type === sportFilter);
    }

    // 2. Text Search Filter (Name/Location)
    if (searchQuery !== '') {
        const query = searchQuery.toLowerCase();
        result = result.filter(a => a.location_label.toLowerCase().includes(query));
    }

    // 3. Distance Range Filter
    if (minDist !== '') {
        const minMeters = parseFloat(minDist) * 1000;
        result = result.filter(a => a.distance >= minMeters);
    }
    if (maxDist !== '') {
        const maxMeters = parseFloat(maxDist) * 1000;
        result = result.filter(a => a.distance <= maxMeters);
    }

    // 4. Date Range Filter
    if (startDate !== '') {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        result = result.filter(a => new Date(a.start_date) >= start);
    }
    if (endDate !== '') {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        result = result.filter(a => new Date(a.start_date) <= end);
    }

    return result;
  }, [activities, sportFilter, searchQuery, minDist, maxDist, startDate, endDate]);

  // Pagination Slice
  const displayedActivities = displayCount === -1 
      ? filteredActivities 
      : filteredActivities.slice(0, displayCount);

  // Totals Calculation
  const totals = useMemo(() => {
      return filteredActivities.reduce((acc, curr) => ({
          distance: acc.distance + curr.distance,
          duration: acc.duration + curr.duration,
          elevation: acc.elevation + curr.elevation_gain,
          load: acc.load + (curr.training_load || 0)
      }), { distance: 0, duration: 0, elevation: 0, load: 0 });
  }, [filteredActivities]);

  return (
    <div className="mt-6 pb-32 md:pb-6 relative">
      
      {/* Header & Main Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
          <div className="text-xs font-mono text-text-secondary px-1 uppercase">Recent Activities</div>
          
          <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <button 
                    onClick={() => setSportFilter('All')}
                    className={`px-3 py-1 rounded-full text-[10px] font-medium border transition-colors whitespace-nowrap ${sportFilter === 'All' ? 'bg-white text-black border-white' : 'bg-transparent text-text-secondary border-white/10 hover:border-white/30'}`}
                >
                    ALL
                </button>
                {Object.values(SportType).map(type => (
                    <button 
                        key={type}
                        onClick={() => setSportFilter(type)}
                        className={`px-3 py-1 rounded-full text-[10px] font-medium border transition-colors whitespace-nowrap ${sportFilter === type ? 'bg-white text-black border-white' : 'bg-transparent text-text-secondary border-white/10 hover:border-white/30'}`}
                    >
                        {type.toUpperCase()}
                    </button>
                ))}
              </div>
              
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`p-1.5 rounded-lg border transition-colors ${showAdvanced ? 'bg-accent-green text-black border-accent-green' : 'bg-transparent text-text-secondary border-white/10 hover:text-white'}`}
              >
                  <SlidersHorizontal size={16} />
              </button>
          </div>
      </div>

      {/* Advanced Filter Panel */}
      {showAdvanced && (
          <div className="mb-4 p-4 bg-card rounded-xl border border-white/5 animate-in slide-in-from-top-2 space-y-4">
              
              {/* Name Search */}
              <div>
                 <div className="text-[10px] text-text-secondary uppercase mb-2 flex items-center gap-1">
                    <Search size={12} />
                    Search Name
                 </div>
                 <input 
                    type="text" 
                    placeholder="e.g. Morning Loop" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-background border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-accent-green outline-none"
                 />
              </div>

              {/* Distance Filters */}
              <div>
                <div className="text-[10px] text-text-secondary uppercase mb-2">Distance Range (km)</div>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <input 
                            type="number" 
                            placeholder="Min" 
                            value={minDist}
                            onChange={(e) => setMinDist(e.target.value)}
                            className="w-full bg-background border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-accent-green outline-none"
                        />
                    </div>
                    <div className="flex-1">
                        <input 
                            type="number" 
                            placeholder="Max" 
                            value={maxDist}
                            onChange={(e) => setMaxDist(e.target.value)}
                            className="w-full bg-background border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-accent-green outline-none"
                        />
                    </div>
                </div>
              </div>

              {/* Date Filters */}
              <div className="pt-3 border-t border-white/5">
                <div className="text-[10px] text-text-secondary uppercase mb-2 flex items-center gap-1">
                    <Calendar size={12} />
                    Date Range
                </div>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-background border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-accent-green outline-none [color-scheme:dark]"
                        />
                    </div>
                    <div className="flex-1">
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-background border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-accent-green outline-none [color-scheme:dark]"
                        />
                    </div>
                </div>
              </div>
          </div>
      )}

      {/* List */}
      <div className="space-y-2 mb-6">
        {displayedActivities.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">No activities match your filters.</div>
        ) : (
            displayedActivities.map((activity) => (
            <div 
                key={activity.id} 
                className="bg-card hover:bg-white/10 transition-colors rounded-xl border border-white/5 p-4 flex flex-col gap-3"
            >
                {/* Top Row: Icon, Type, Location, Date */}
                <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white/5 ${getSportColor(activity.sport_type)}`}>
                        {getSportIcon(activity.sport_type)}
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
            ))
        )}
      </div>

      {/* Pagination Selector */}
      {filteredActivities.length > 20 && (
         <div className="flex justify-center mb-6">
            <div className="bg-card border border-white/5 rounded-lg flex overflow-hidden">
                {[20, 50, 100, -1].map((count) => (
                    <button
                        key={count}
                        onClick={() => setDisplayCount(count)}
                        className={`px-4 py-1.5 text-xs font-medium border-r border-white/5 last:border-0 hover:bg-white/5 transition-colors ${displayCount === count ? 'bg-white text-black hover:bg-white' : 'text-text-secondary'}`}
                    >
                        {count === -1 ? 'All' : count}
                    </button>
                ))}
            </div>
         </div>
      )}

      {/* Totals Banner (Sticky at bottom of tab) */}
      <div className="sticky bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-white/10 p-3 rounded-t-xl shadow-2xl z-10 md:static md:rounded-xl md:mt-4 md:border">
        <div className="text-[10px] font-mono text-text-secondary uppercase mb-2">Total Selection ({filteredActivities.length})</div>
        <div className="grid grid-cols-4 gap-4">
             <div>
                 <span className="block text-[9px] text-text-secondary uppercase">Dist</span>
                 <span className="text-sm font-mono font-bold text-white">{(totals.distance / 1000).toFixed(0)} km</span>
             </div>
             <div>
                 <span className="block text-[9px] text-text-secondary uppercase">Time</span>
                 <span className="text-sm font-mono font-bold text-white">{(totals.duration / 3600).toFixed(0)}h</span>
             </div>
             <div>
                 <span className="block text-[9px] text-text-secondary uppercase">Elev</span>
                 <span className="text-sm font-mono font-bold text-white">{totals.elevation.toLocaleString()} m</span>
             </div>
             <div>
                 <span className="block text-[9px] text-text-secondary uppercase">Load</span>
                 <span className="text-sm font-mono font-bold text-accent-blurple">{totals.load.toLocaleString()}</span>
             </div>
        </div>
      </div>

    </div>
  );
};

export default ActivityList;