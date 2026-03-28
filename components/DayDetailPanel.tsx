import React from 'react';
import { CalendarEvent } from '../types';
import { X } from 'lucide-react';

interface DayDetailPanelProps {
  date: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onDelete: (id: string) => void;
}

const DayDetailPanel: React.FC<DayDetailPanelProps> = ({ date, events, onClose, onDelete }) => {
  const sorted = [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  return (
    <div className="mt-2 bg-card border border-white/10 rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-medium text-white">{formatDate(date)}</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full">
          <X size={16} className="text-text-secondary" />
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-text-secondary">
          No events
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {sorted.map(ev => {
            const start = new Date(ev.start);
            const end = new Date(ev.end);
            const timeRange = ev.isAllDay
              ? 'All day'
              : `${formatTime(ev.start)} — ${formatTime(ev.end)}`;

            return (
              <div key={ev.id} className="flex items-start gap-3 px-4 py-3 group">
                <div
                  className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: ev.color || '#6366f1' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{ev.title}</div>
                  <div className="text-xs text-text-secondary mt-0.5">{timeRange}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ev.source === 'gcal' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blurple/20 text-accent-blurple font-mono">
                      Google
                    </span>
                  )}
                  {ev.source === 'local' && (
                    <button
                      onClick={() => onDelete(ev.id)}
                      className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition-opacity"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DayDetailPanel;
