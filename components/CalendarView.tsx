import React from 'react';
import { CalendarEvent } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
  events: CalendarEvent[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ events }) => {
  const currentDate = new Date();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  // Create grid cells
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getEventsForDay = (day: number) => {
    // Very simplified date check for demo
    return events.filter(e => {
        const d = new Date(e.start);
        return d.getDate() === day && d.getMonth() === currentDate.getMonth();
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 p-2">
        <h2 className="text-xl font-bold text-white">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
            <button className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft size={20} /></button>
            <button className="p-2 hover:bg-white/10 rounded-full"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['S','M','T','W','T','F','S'].map(d => (
            <div key={d} className="text-xs font-mono text-text-secondary py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 auto-rows-fr flex-grow">
        {blanks.map(x => <div key={`blank-${x}`} className="bg-transparent" />)}
        {days.map(d => {
            const dayEvents = getEventsForDay(d);
            const isToday = d === new Date().getDate();
            return (
                <div key={d} className={`min-h-[80px] bg-card border ${isToday ? 'border-accent-green' : 'border-white/5'} rounded-lg p-1.5 flex flex-col gap-1 hover:bg-white/5 transition-colors`}>
                    <span className={`text-xs font-mono ${isToday ? 'text-accent-green font-bold' : 'text-text-secondary'}`}>{d}</span>
                    <div className="flex flex-col gap-1 mt-1">
                        {dayEvents.map(ev => (
                            <div key={ev.id} className="text-[9px] truncate px-1 py-0.5 rounded text-black font-medium" style={{ backgroundColor: ev.color }}>
                                {ev.title}
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default CalendarView;