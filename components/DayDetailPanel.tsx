import React, { useState } from 'react';
import { CalendarEvent } from '../types';
import { X, Star, MapPin, FileText } from 'lucide-react';

interface DayDetailPanelProps {
  date: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (event: CalendarEvent) => void;
}

const DayDetailPanel: React.FC<DayDetailPanelProps> = ({ date, events, onClose, onDelete, onToggleFavorite }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const isPast = (iso: string) => new Date(iso) < new Date();

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
            const timeRange = ev.isAllDay
              ? 'All day'
              : `${formatTime(ev.start)} — ${formatTime(ev.end)}`;
            const isExpanded = expandedId === ev.id;
            const past = isPast(ev.end);

            return (
              <div key={ev.id}>
                {/* Event row — clickable to expand */}
                <div
                  className="flex items-start gap-3 px-4 py-3 group cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: ev.color || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${past ? 'text-text-secondary' : 'text-white'}`}>{ev.title}</div>
                    <div className="text-xs text-text-secondary mt-0.5">{timeRange}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Star toggle */}
                    <button
                      onClick={() => onToggleFavorite(ev)}
                      className="p-0.5 hover:bg-white/10 rounded transition-colors"
                      aria-label={ev.isFavorite ? `Remove ${ev.title} from favorites` : `Add ${ev.title} to favorites`}
                    >
                      <Star
                        size={14}
                        className={ev.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-white/40 hover:text-yellow-400'}
                      />
                    </button>
                    {ev.source === 'gcal' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blurple/20 text-accent-blurple font-mono">
                        Google
                      </span>
                    )}
                    {ev.source === 'ical' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blurple/20 text-accent-blurple font-mono">
                        iCal
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

                {/* Expanded inline detail card */}
                {isExpanded && (
                  <div className="px-4 pb-4 -mt-1 animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
                    <div className="bg-background border border-white/10 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white">{ev.title}</h4>
                        <button
                          onClick={() => onToggleFavorite(ev)}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                          aria-label={ev.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star
                            size={16}
                            className={ev.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-white/40 hover:text-yellow-400'}
                          />
                        </button>
                      </div>
                      <div className="text-xs text-text-secondary">
                        <span className="inline-block px-1.5 py-0.5 rounded mr-2" style={{ backgroundColor: (ev.color || '#6366f1') + '33', color: ev.color || '#6366f1' }}>
                          {ev.isAllDay ? 'All day' : timeRange}
                        </span>
                        {ev.source !== 'local' && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-white/5">
                            {ev.source === 'gcal' ? 'Google Calendar' : 'iCal'}
                          </span>
                        )}
                      </div>
                      {ev.ical_location && (
                        <div className="flex items-start gap-1.5 text-xs text-text-secondary">
                          <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                          <span>{ev.ical_location}</span>
                        </div>
                      )}
                      {ev.ical_description && (
                        <div className="flex items-start gap-1.5 text-xs text-text-secondary">
                          <FileText size={12} className="mt-0.5 flex-shrink-0" />
                          <span className="whitespace-pre-wrap">{ev.ical_description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DayDetailPanel;
