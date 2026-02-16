import React, { useState } from 'react';
import Layout from './components/Layout';
import ActivityRings from './components/ActivityRings';
import Heatmap from './components/Heatmap';
import ActivityList from './components/ActivityList';
import CalendarView from './components/CalendarView';
import { MOCK_ACTIVITIES, MOCK_DAILY_METRICS, MOCK_EVENTS } from './services/mockData';
import { Save, RefreshCw } from 'lucide-react';

// Main App Component
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sport' | 'planning' | 'settings'>('sport');

  // Sport View
  const SportView = () => (
    <div className="animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <ActivityRings metrics={MOCK_DAILY_METRICS} />
        <Heatmap />
      </div>
      <ActivityList activities={MOCK_ACTIVITIES} />
    </div>
  );

  // Planning View
  const PlanningView = () => (
     <div className="h-[80vh] animate-in fade-in duration-500">
        <CalendarView events={MOCK_EVENTS} />
     </div>
  );

  // Settings View
  const SettingsView = () => (
    <div className="max-w-md mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        <h2 className="text-2xl font-bold mb-6">Settings</h2>
        
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-card border border-white/5">
                <h3 className="text-lg font-medium mb-4 text-accent-green">Strava Sync</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-mono text-text-secondary mb-1">CLIENT ID</label>
                        <input type="text" className="w-full bg-background border border-white/10 rounded p-2 text-sm text-white focus:border-accent-green outline-none transition-colors" placeholder="12345" />
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-text-secondary mb-1">CLIENT SECRET</label>
                        <input type="password" className="w-full bg-background border border-white/10 rounded p-2 text-sm text-white focus:border-accent-green outline-none transition-colors" placeholder="••••••••••••••••••••••" />
                    </div>
                </div>
            </div>

            <div className="p-4 rounded-xl bg-card border border-white/5">
                <h3 className="text-lg font-medium mb-4 text-blue-400">Google Services</h3>
                <p className="text-xs text-text-secondary mb-4">Required for Google Fit (Activity) and Calendar integration.</p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-mono text-text-secondary mb-1">GOOGLE CLIENT ID</label>
                        <input type="text" className="w-full bg-background border border-white/10 rounded p-2 text-sm text-white focus:border-blue-400 outline-none transition-colors" placeholder="apps.googleusercontent.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-text-secondary mb-1">GOOGLE CLIENT SECRET</label>
                        <input type="password" className="w-full bg-background border border-white/10 rounded p-2 text-sm text-white focus:border-blue-400 outline-none transition-colors" placeholder="••••••••••••••••••••••" />
                    </div>
                </div>
            </div>

            <button className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white p-3 rounded transition-colors border border-white/5">
                <Save size={16} />
                <span>Save All Credentials</span>
            </button>

            <div className="p-4 rounded-xl bg-card border border-white/5">
                <h3 className="text-lg font-medium mb-4 text-accent-blurple">System Status</h3>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-text-secondary">Last Sync</span>
                    <span className="text-sm font-mono">Today, 08:30 AM</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-text-secondary">Database Size</span>
                    <span className="text-sm font-mono">4.2 MB</span>
                </div>
                <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-text-secondary">Next Job</span>
                    <span className="text-sm font-mono">In 3h 15m</span>
                </div>
                <button className="w-full flex items-center justify-center gap-2 bg-accent-blurple/10 hover:bg-accent-blurple/20 text-accent-blurple p-2 rounded transition-colors border border-accent-blurple/20 mt-4">
                    <RefreshCw size={16} />
                    <span>Trigger Manual Sync</span>
                </button>
            </div>
        </div>
    </div>
  );

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'sport' && <SportView />}
      {activeTab === 'planning' && <PlanningView />}
      {activeTab === 'settings' && <SettingsView />}
    </Layout>
  );
};

export default App;