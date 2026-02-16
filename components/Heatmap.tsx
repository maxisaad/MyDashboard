import React from 'react';
import { Activity, SportType, CalendarEvent } from '../types';
import { Footprints, Bike, Waves, Dumbbell, Mountain, Zap, Calendar as CalendarIcon } from 'lucide-react';

interface HeatmapProps {
    activities: Activity[];
    events?: CalendarEvent[];
}

const Heatmap: React.FC<HeatmapProps> = ({ activities, events = [] }) => {
  // Calculate Start of Current Week (Monday)
  const today = new Date();
  const day = today.getDay(); 
  // Adjust to Monday: If Sunday (0), subtract 6. Else subtract day-1.
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const currentMonday = new Date(today);
  currentMonday.setDate(diff);
  currentMonday.setHours(0,0,0,0);

  const weeksData = [
      { label: 'Last Week', offset: -1 },
      { label: 'Current Week', offset: 0 },
      { label: 'Next Week', offset: 1 },
  ];

  const weeks = weeksData.map(weekInfo => {
      const startOfWeek = new Date(currentMonday);
      startOfWeek.setDate(currentMonday.getDate() + (weekInfo.offset * 7));
      
      const days = Array.from({length: 7}, (_, i) => {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          return d;
      });
      return { ...weekInfo, days };
  });

  const isSameDay = (d1: Date, d2String: string) => {
      const d2 = new Date(d2String);
      return d1.getDate() === d2.getDate() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getFullYear() === d2.getFullYear();
  };

  const getDayActivity = (date: Date) => {
      return activities.find(a => isSameDay(date, a.start_date));
  };

  const getDayEvent = (date: Date) => {
      return events.find(e => isSameDay(date, e.start));
  };

  const getSportFromEvent = (title: string): SportType | null => {
      const t = title.toLowerCase();
      if (t.includes('run')) return SportType.Run;
      if (t.includes('ride') || t.includes('bike') || t.includes('cycle')) return SportType.Ride;
      if (t.includes('swim')) return SportType.Swim;
      if (t.includes('gym') || t.includes('weight') || t.includes('lift')) return SportType.WeightTraining;
      if (t.includes('hike')) return SportType.Hike;
      return null;
  };

  const getSportIcon = (type: SportType, size: number = 14) => {
    switch (type) {
        case SportType.Run: return <Footprints size={size} />;
        case SportType.Ride: return <Bike size={size} />;
        case SportType.Swim: return <Waves size={size} />;
        case SportType.WeightTraining: return <Dumbbell size={size} />;
        case SportType.Hike: return <Mountain size={size} />;
        default: return <Zap size={size} />;
    }
  };

  const getColor = (type: SportType) => {
    switch (type) {
        case SportType.Run: return 'bg-lime-400 text-black';
        case SportType.Ride: return 'bg-cyan-400 text-black';
        case SportType.Swim: return 'bg-blue-400 text-black';
        case SportType.WeightTraining: return 'bg-red-400 text-black';
        case SportType.Hike: return 'bg-amber-400 text-black';
        default: return 'bg-white/20 text-white';
    }
  };

  return (
    <div className="w-full bg-card rounded-xl border border-white/5 p-4 flex flex-col h-full min-h-[220px]">
      <div className="flex justify-between items-center mb-2">
          <div className="text-xs font-mono text-text-secondary uppercase">Weekly Analysis</div>
      </div>
      
      <div className="flex flex-col gap-4 justify-center flex-1 py-2">
        {weeks.map((week, wIndex) => (
            <div key={wIndex} className="flex flex-col gap-1.5">
                <span className={`text-[9px] font-mono uppercase ${week.offset === 0 ? 'text-white font-bold' : 'text-text-secondary'}`}>
                    {week.label}
                </span>
                <div className="flex gap-2">
                    {week.days.map((day, dIndex) => {
                        let content = null;
                        let className = "bg-white/5";

                        if (week.offset <= 0) {
                            // Last Week & Current Week: Show completed Activities
                            const activity = getDayActivity(day);
                            if (activity) {
                                className = getColor(activity.sport_type);
                                content = getSportIcon(activity.sport_type);
                            }
                        } else {
                            // Next Week: Show Calendar Events
                            const event = getDayEvent(day);
                            if (event) {
                                const sport = getSportFromEvent(event.title);
                                if (sport) {
                                    className = getColor(sport) + ' opacity-75'; // Slightly dimmed for planned
                                    content = getSportIcon(sport);
                                } else {
                                     // Generic event
                                     className = 'bg-white/20 text-white';
                                     content = <CalendarIcon size={14} />;
                                }
                            }
                        }

                        // Highlight Today
                        const isToday = new Date().toDateString() === day.toDateString();
                        const borderClass = isToday ? 'ring-1 ring-white' : '';

                        return (
                            <div 
                                key={dIndex} 
                                className={`flex-1 aspect-square rounded-md flex items-center justify-center transition-colors ${className} ${borderClass}`}
                                title={day.toLocaleDateString()}
                            >
                                {content}
                            </div>
                        );
                    })}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default Heatmap;