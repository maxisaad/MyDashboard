import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Layout from './components/Layout';
import ActivityRings from './components/ActivityRings';
import Heatmap from './components/Heatmap';
import ActivityList from './components/ActivityList';
import CalendarView from './components/CalendarView';
import Settings from './components/Settings';
import StravaCallback from './components/StravaCallback';
import { MOCK_DAILY_METRICS, MOCK_EVENTS } from './services/mockData';
import { Activity } from './types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sport' | 'planning' | 'settings'>('sport');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (window.location.pathname === '/strava-callback') {
      return;
    }
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (error) throw error;

      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (window.location.pathname === '/strava-callback') {
    return <StravaCallback />;
  }

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
          <button
            onClick={() => setActiveTab('settings')}
            className="bg-accent-green hover:bg-accent-green/90 text-black px-6 py-2 rounded transition-colors font-medium"
          >
            Connect Strava
          </button>
        </div>
      );
    }

    return (
      <div className="animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ActivityRings metrics={MOCK_DAILY_METRICS} />
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
      {activeTab === 'settings' && <Settings />}
    </Layout>
  );
};

export default App;