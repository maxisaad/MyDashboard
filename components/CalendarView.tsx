import React, { useState, useEffect, useCallback } from 'react';
import { CalendarEvent } from '../types';
import { ChevronLeft, ChevronRight, Plus, X, Star } from 'lucide-react';
import { env } from '../lib/env';
import DayDetailPanel from './DayDetailPanel';

const API_BASE = env.VITE_API_URL;

const EVENT_COLORS = ['#a3e635', '#6366f1', '#a1a1aa', '#f97316', '#ec4899', '#14b8a6'];

const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newColor, setNewColor] = useState(EVENT_COLORS[0]);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/events`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const addEvent = async () => {
    if (!newTitle.trim() || !newDate) return;
    try {
      const startDate = new Date(newDate);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);

      await fetch(`${API_BASE}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          is_all_day: false,
          color: newColor,
        }),
      });
      setNewTitle('');
      setNewDate('');
      setShowForm(false);
      loadEvents();
    } catch (error) {
      console.error('Error adding event:', error);
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/events/${id}`, { method: 'DELETE' });
      loadEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const toggleFavorite = async (ev: CalendarEvent) => {
    const newVal = !ev.isFavorite;
    // Optimistic update
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, isFavorite: newVal } : e));
    try {
      if (ev.source === 'ical') {
        const realId = ev.id.replace('ical-', '');
        await fetch(`${API_BASE}/api/ical/events/${realId}/favorite`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_favorite: newVal }),
        });
      } else {
        await fetch(`${API_BASE}/api/events/${ev.id}/favorite`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_favorite: newVal }),
        });
      }
    } catch (error) {
      // Revert on error
      setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, isFavorite: !newVal } : e));
      console.error('Error toggling favorite:', error);
    }
  };

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(null);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  // Adjust for Monday-start calendar (0=Mon, 6=Sun)
  const mondayBlanks = (firstDayOfMonth + 6) % 7;
  const blanks = Array.from({ length: mondayBlanks }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getEventsForDay = (day: number) => {
    return events.filter(e => {
      const d = new Date(e.start);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  // Pinned events: sorted chronologically
  const pinnedEvents = events
    .filter(e => e.isFavorite)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const selectedDate = selectedDay ? new Date(year, month, selectedDay) : null;
  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  const formatPinnedDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isPastEvent = (iso: string) => new Date(iso) < today;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 p-2">
        <h2 className="text-xl font-bold text-white">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2 items-center">
          <button onClick={goToPrevMonth} className="p-2 hover:bg-white/10 rounded-full">
            <ChevronLeft size={20} />
          </button>
          <button onClick={goToToday} className="text-xs font-mono text-text-secondary hover:text-white px-2 py-1 hover:bg-white/10 rounded">
            Today
          </button>
          <button onClick={goToNextMonth} className="p-2 hover:bg-white/10 rounded-full">
            <ChevronRight size={20} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="p-2 hover:bg-white/10 rounded-full ml-2">
            {showForm ? <X size={18} /> : <Plus size={18} />}
          </button>
        </div>
      </div>

      {/* Pinned Events Section */}
      {pinnedEvents.length > 0 && (
        <div className="mb-4 bg-card border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
            <Star size={14} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Pinned</span>
          </div>
          <div className="flex gap-2 p-2 overflow-x-auto max-h-[80px]" style={{ scrollbarWidth: 'thin' }}>
            {pinnedEvents.map(ev => {
              const past = isPastEvent(ev.end);
              return (
                <button
                  key={`pinned-${ev.id}`}
                  onClick={() => toggleFavorite(ev)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors hover:bg-white/5 ${
                    past ? 'opacity-50 border-white/5' : 'border-white/10'
                  }`}
                  title="Click star to unpin"
                  aria-label={`Remove ${ev.title} from favorites`}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ev.color || '#6366f1' }}
                  />
                  <span className={`text-xs truncate max-w-[120px] ${past ? 'text-text-secondary line-through' : 'text-white'}`}>
                    {ev.title}
                  </span>
                  <span className="text-[10px] text-text-secondary flex-shrink-0">
                    {formatPinnedDate(ev.start)}
                  </span>
                  <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Event Form */}
      {showForm && (
        <div className="mb-4 p-3 bg-card border border-white/10 rounded-xl flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-text-secondary block mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Event name..."
              className="w-full bg-background border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-accent-green"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Date</label>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="bg-background border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-accent-green"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Color</label>
            <div className="flex gap-1">
              {EVENT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${newColor === c ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={addEvent}
            disabled={!newTitle.trim() || !newDate}
            className="bg-accent-green hover:bg-accent-green/90 text-black px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={`${d}-${i}`} className="text-xs font-mono text-text-secondary py-2">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 auto-rows-fr flex-grow">
        {blanks.map(x => <div key={`blank-${x}`} className="bg-transparent" />)}
        {days.map(d => {
          const dayEvents = getEventsForDay(d);
          const isToday = isCurrentMonth && d === today.getDate();
          const isSelected = selectedDay === d;

          return (
            <div
              key={d}
              onClick={() => setSelectedDay(selectedDay === d ? null : d)}
              className={`min-h-[80px] bg-card border cursor-pointer rounded-lg p-1.5 flex flex-col gap-1 hover:bg-white/5 transition-colors ${
                isToday ? 'border-accent-green' : isSelected ? 'border-accent-blurple' : 'border-white/5'
              }`}
            >
              <span className={`text-xs font-mono ${isToday ? 'text-accent-green font-bold' : isSelected ? 'text-accent-blurple font-bold' : 'text-text-secondary'}`}>
                {d}
              </span>
              <div className="flex flex-col gap-0.5 mt-1 overflow-hidden">
                {/* All-day events as chips */}
                {dayEvents.filter(e => e.isAllDay).slice(0, 1).map(ev => (
                  <div
                    key={ev.id}
                    className="text-[9px] truncate px-1 py-0.5 rounded text-black font-medium flex items-center gap-0.5"
                    style={{ backgroundColor: ev.color || '#6366f1' }}
                    title={ev.title}
                  >
                    {ev.isFavorite && <Star size={7} className="fill-black flex-shrink-0" />}
                    {ev.title}
                  </div>
                ))}
                {/* Timed events as dots */}
                <div className="flex flex-wrap gap-0.5">
                  {dayEvents.filter(e => !e.isAllDay).slice(0, 3).map(ev => (
                    <div
                      key={ev.id}
                      className="w-1.5 h-1.5 rounded-full relative"
                      style={{ backgroundColor: ev.color || '#6366f1' }}
                      title={`${ev.title}${ev.isFavorite ? ' ★' : ''}`}
                    >
                      {ev.isFavorite && (
                        <div className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-yellow-400 rounded-full" />
                      )}
                    </div>
                  ))}
                  {dayEvents.filter(e => !e.isAllDay).length > 3 && (
                    <span className="text-[8px] text-text-secondary">
                      +{dayEvents.filter(e => !e.isAllDay).length - 3}
                    </span>
                  )}
                </div>
                {/* Overflow for all-day events */}
                {dayEvents.filter(e => e.isAllDay).length > 1 && (
                  <span className="text-[8px] text-text-secondary">
                    +{dayEvents.filter(e => e.isAllDay).length - 1} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Detail Panel */}
      {selectedDay && selectedDate && (
        <DayDetailPanel
          date={selectedDate}
          events={selectedEvents}
          onClose={() => setSelectedDay(null)}
          onDelete={deleteEvent}
          onToggleFavorite={toggleFavorite}
        />
      )}
    </div>
  );
};

export default CalendarView;
