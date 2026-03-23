import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import ActivityRings from './components/ActivityRings';
import Heatmap from './components/Heatmap';
import ActivityList from './components/ActivityList';
import CalendarView from './components/CalendarView';
import Settings from './components/Settings';
import { MOCK_EVENTS } from './services/mockData';
import { computeDailyMetrics, computeWeeklySummary } from './services/metrics';
import { Activity } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8765';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sport' | 'planning' | 'settings'>('sport');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/activities`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

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
          <Heatmap activities={activities} events={MOCK_EVENTS} />
        </div>
        <ActivityList activities={activities} />
      </div>
    );
  };

  const PlanningView = () => (
    <div className="h-[80vh] animate-in fade-in duration-500">
      <CalendarView events={MOCK_EVENTS} />
    </div>
  );

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'sport' && <SportView />}
      {activeTab === 'planning' && <PlanningView />}
      {activeTab === 'settings' && <Settings onSyncComplete={loadActivities} />}
    </Layout>
  );
};

export default App;
