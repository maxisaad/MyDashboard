import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const Settings: React.FC = () => {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [manualSyncStatus, setManualSyncStatus] = useState<string | null>(null);
  const [manualSyncRunning, setManualSyncRunning] = useState(false);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIsConnected(!!data.strava_access_token);
        setLastSync(data.last_sync_at);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const triggerManualSync = async () => {
    setManualSyncStatus(null);
    setManualSyncRunning(true);
    try {
      const response = await fetch('http://localhost:8765/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.status === 202) {
        setManualSyncStatus('Manual sync started. It may take a minute to appear in the dashboard.');
      } else if (response.status === 409) {
        setManualSyncStatus('Sync is already running. Please wait.');
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Unexpected response: ${response.status}`);
      }
    } catch (e: any) {
      console.error('Manual sync error:', e);
      setManualSyncStatus(e.message || 'Failed to trigger manual sync');
    } finally {
      setManualSyncRunning(false);
      // Give the sync some time then refresh status
      setTimeout(() => {
        loadSettings();
      }, 5000);
    }
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="max-w-md mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
        {manualSyncStatus && (
          <div className="p-3 rounded-xl bg-card border border-white/10 flex items-center gap-2 text-sm">
            <CheckCircle size={14} className="text-accent-green" />
            <span>{manualSyncStatus}</span>
          </div>
        )}

        <div className="p-4 rounded-xl bg-card border border-white/5">
          <h3 className="text-lg font-medium mb-4 text-accent-blurple">System Status</h3>
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-text-secondary">Last Sync</span>
            <span className="text-sm font-mono">{formatLastSync(lastSync)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-text-secondary">Status</span>
            <span className="text-sm font-mono">
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-text-secondary">Auto Sync</span>
            <span className="text-sm font-mono">Daily at 23:30 (local service)</span>
          </div>
          <button
            type="button"
            onClick={triggerManualSync}
            disabled={!isConnected || manualSyncRunning}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-accent-blurple/10 hover:bg-accent-blurple/20 text-accent-blurple p-2 rounded transition-colors border border-accent-blurple/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {manualSyncRunning ? 'Starting manual sync…' : 'Trigger Manual Sync (local service)'}
          </button>
          <p className="mt-2 text-xs text-text-secondary">
            This button calls the local Python sync service running on your Raspberry Pi (port 8765). Make sure
            <code> local_strava_sync.py</code> is running.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
