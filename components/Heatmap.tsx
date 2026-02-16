import React from 'react';

const Heatmap: React.FC = () => {
  // Generate last 21 days (3 weeks)
  const weeks = [2, 1, 0].map(weekOffset => {
      return Array.from({ length: 7 }, (_, dayIndex) => {
          const d = new Date();
          // Adjust to get blocks of 7 days
          const daysToSubtract = (weekOffset * 7) + (6 - dayIndex);
          d.setDate(d.getDate() - daysToSubtract);
          return d;
      });
  });

  // Mock intensity (0-4)
  const getIntensity = (date: Date) => {
    const day = date.getDate();
    if (day % 7 === 0) return 4;
    if (day % 3 === 0) return 2;
    if (day % 5 === 0) return 0;
    return 1;
  };

  const getColor = (intensity: number) => {
    switch (intensity) {
      case 0: return 'bg-white/5';
      case 1: return 'bg-lime-900/40';
      case 2: return 'bg-lime-700/60';
      case 3: return 'bg-lime-500/80';
      case 4: return 'bg-lime-400';
      default: return 'bg-white/5';
    }
  };

  return (
    <div className="w-full bg-card rounded-xl border border-white/5 p-4 flex flex-col justify-between h-40 md:h-auto">
      <div className="text-xs font-mono text-text-secondary uppercase mb-2">Consistency</div>
      
      <div className="flex flex-col gap-2 h-full justify-center">
        {weeks.map((week, wIndex) => (
            <div key={wIndex} className="flex justify-between gap-2">
                {week.map((day, dIndex) => (
                    <div key={dIndex} className="flex-1 aspect-square relative group">
                        <div 
                            className={`w-full h-full rounded-sm ${getColor(getIntensity(day))}`}
                        ></div>
                        {/* Tooltip on hover */}
                        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black text-[9px] text-white rounded whitespace-nowrap z-10">
                            {day.toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                        </div>
                    </div>
                ))}
            </div>
        ))}
      </div>
      
      <div className="flex justify-between mt-1 px-0.5">
          <span className="text-[9px] text-text-secondary font-mono">2 Weeks Ago</span>
          <span className="text-[9px] text-text-secondary font-mono">This Week</span>
      </div>
    </div>
  );
};

export default Heatmap;