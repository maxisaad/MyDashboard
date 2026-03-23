import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import ActivityRings from './components/ActivityRings';
import Heatmap from './components/Heatmap';
import ActivityList from './components/ActivityList';
import CalendarView from './components/CalendarView';
import Settings from './components/Settings';
import ErrorBoundary from './components/ErrorBoundary';
import { computeDailyMetrics, computeWeeklySummary } from './services/metrics';
import { Activity, CalendarEvent } from './types';
import { env } from './lib/env';

const API_BASE = env.VITE_API_URL;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sport' | 'planning' | 'settings'>('sport');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [actsRes, evtsRes] = await Promise.all([
        fetch(`${API_BASE}/api/activities`),
        fetch(`${API_BASE}/api/events`),
      ]);
      if (actsRes.ok) {
        const actsData = await actsRes.json();
        setActivities(actsData.activities || []);
      }
      if (evtsRes.ok) {
        const evtsData = await evtsRes.json();
        setEvents(evtsData.events || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dailyMetrics = computeDailyMetrics(activities, new Date());
  const weeklySummary = computeWeeklySummary(activities);

  const SportView = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-text-secondary">Loading activities...</div>
        </div>
      );
    }

    if (activities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-text-secondary mb-4">No activities found</div>
          <p className="text-text-secondary text-sm mb-4">
            Connect your Strava account from Settings, then trigger a sync.
          </p>
          <button
            onClick={() => setActiveTab('settings')}
            className="bg-accent-green hover:bg-accent-green/90 text-black px-6 py-2 rounded transition-colors font-medium"
          >
            Go to Settings
          </button>
        </div>
      );
    }

    return (
      <div className="animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ActivityRings metrics={dailyMetrics} weekly={weeklySummary} />
          <Heatmap activities={activities} events={events} />
        </div>
        <ActivityList activities={activities} />
      </div>
    );
  };

  const PlanningView = () => (
    <div className="h-[80vh] animate-in fade-in duration-500">
      <CalendarView />
    </div>
  );

  return (
    <ErrorBoundary>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'sport' && <ErrorBoundary><SportView /></ErrorBoundary>}
        {activeTab === 'planning' && <ErrorBoundary><PlanningView /></ErrorBoundary>}
        {activeTab === 'settings' && <ErrorBoundary><Settings onSyncComplete={loadData} /></ErrorBoundary>}
      </Layout>
    </ErrorBoundary>
  );
};

export default App;
