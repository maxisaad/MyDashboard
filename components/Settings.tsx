import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const Settings: React.FC = () => {
  const [stravaClientId, setStravaClientId] = useState('');
  const [stravaClientSecret, setStravaClientSecret] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

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

  const handleConnect = async () => {
    if (!stravaClientId) {
      setSyncStatus({ type: 'error', message: 'Please enter your Strava Client ID' });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSyncStatus({ type: 'error', message: 'You must be logged in' });
        return;
      }

      const redirectUri = `${window.location.origin}/strava-callback`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-oauth?action=authorize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: stravaClientId,
            redirectUri,
          }),
        }
      );

      const data = await response.json();

      if (data.authUrl) {
        localStorage.setItem('strava_client_id', stravaClientId);
        localStorage.setItem('strava_client_secret', stravaClientSecret);
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting to Strava:', error);
      setSyncStatus({ type: 'error', message: 'Failed to connect to Strava' });
    }
  };

  const handleSync = async () => {
    if (!stravaClientId || !stravaClientSecret) {
      setSyncStatus({ type: 'error', message: 'Please enter your Strava credentials first' });
      return;
    }

    setSyncing(true);
    setSyncStatus(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: stravaClientId,
            clientSecret: stravaClientSecret,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSyncStatus({
        type: 'success',
        message: `Successfully synced ${data.activitiesProcessed} activities!`,
      });
      setLastSync(new Date().toISOString());
      await loadSettings();
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncStatus({
        type: 'error',
        message: error.message || 'Failed to sync activities',
      });
    } finally {
      setSyncing(false);
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
        <div className="p-4 rounded-xl bg-card border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-accent-green">Strava Sync</h3>
            {isConnected && (
              <span className="text-xs bg-accent-green/20 text-accent-green px-2 py-1 rounded-full flex items-center gap-1">
                <CheckCircle size={12} />
                Connected
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-text-secondary mb-1">
                CLIENT ID
              </label>
              <input
                type="text"
                value={stravaClientId}
                onChange={(e) => setStravaClientId(e.target.value)}
                className="w-full bg-background border border-white/10 rounded p-2 text-sm text-white focus:border-accent-green outline-none transition-colors"
                placeholder="12345"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-text-secondary mb-1">
                CLIENT SECRET
              </label>
              <input
                type="password"
                value={stravaClientSecret}
                onChange={(e) => setStravaClientSecret(e.target.value)}
                className="w-full bg-background border border-white/10 rounded p-2 text-sm text-white focus:border-accent-green outline-none transition-colors"
                placeholder="••••••••••••••••••••••"
              />
            </div>
            {!isConnected && (
              <button
                onClick={handleConnect}
                className="w-full flex items-center justify-center gap-2 bg-accent-green hover:bg-accent-green/90 text-black p-3 rounded transition-colors font-medium"
              >
                <Save size={16} />
                <span>Connect to Strava</span>
              </button>
            )}
          </div>
        </div>

        {syncStatus && (
          <div
            className={`p-4 rounded-xl border ${
              syncStatus.type === 'success'
                ? 'bg-accent-green/10 border-accent-green/20 text-accent-green'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {syncStatus.type === 'success' ? (
                <CheckCircle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span className="text-sm">{syncStatus.message}</span>
            </div>
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
            <span className="text-sm font-mono">Daily at 23:00</span>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing || !isConnected}
            className="w-full flex items-center justify-center gap-2 bg-accent-blurple/10 hover:bg-accent-blurple/20 text-accent-blurple p-2 rounded transition-colors border border-accent-blurple/20 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <span>Trigger Manual Sync</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
