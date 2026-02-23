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
  const [credentialsConfigured, setCredentialsConfigured] = useState(false);
  const [clientIdMasked, setClientIdMasked] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setSyncing] = useState(false);
  const [isSavingCredentials, setSavingCredentials] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const loadCredentialsConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-config`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      if (data.error) return;
      setCredentialsConfigured(!!data.configured);
      setClientIdMasked(data.clientIdMasked ?? null);
    } catch (e) {
      console.error('Error loading Strava config:', e);
    }
  };

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
    loadCredentialsConfig();
    const storedId = localStorage.getItem('strava_client_id');
    const storedSecret = localStorage.getItem('strava_client_secret');
    if (storedId) setStravaClientId(storedId);
    if (storedSecret) setStravaClientSecret(storedSecret);
  }, []);

  const handleSaveCredentials = async () => {
    if (!stravaClientId.trim() || !stravaClientSecret.trim()) {
      setSyncStatus({ type: 'error', message: 'Enter both Client ID and Client Secret to save.' });
      return;
    }
    setSavingCredentials(true);
    setSyncStatus(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-config`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: stravaClientId.trim(),
            clientSecret: stravaClientSecret.trim(),
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSyncStatus({ type: 'success', message: 'Strava credentials saved. They will be used for Connect and daily sync.' });
      setStravaClientSecret('');
      await loadCredentialsConfig();
    } catch (err: any) {
      setSyncStatus({ type: 'error', message: err.message || 'Failed to save credentials' });
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleConnect = async () => {
    const hasCredentials = credentialsConfigured || (stravaClientId.trim() && stravaClientSecret.trim());
    if (!hasCredentials) {
      setSyncStatus({ type: 'error', message: 'Save your Strava credentials first (Client ID and Secret), then click Connect to Strava.' });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSyncStatus({ type: 'error', message: 'You must be logged in' });
        return;
      }

      const redirectUri = `${window.location.origin}/strava-callback`;
      const session = (await supabase.auth.getSession()).data.session;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-oauth?action=authorize`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...(stravaClientId.trim() && { clientId: stravaClientId.trim() }),
            redirectUri,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        setSyncStatus({ type: 'error', message: data.error });
        return;
      }
      if (data.authUrl) {
        if (stravaClientId.trim()) localStorage.setItem('strava_client_id', stravaClientId.trim());
        if (stravaClientSecret.trim()) localStorage.setItem('strava_client_secret', stravaClientSecret.trim());
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting to Strava:', error);
      setSyncStatus({ type: 'error', message: 'Failed to connect to Strava' });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const hasLocalCredentials = stravaClientId && stravaClientSecret;
      const body = hasLocalCredentials
        ? { clientId: stravaClientId, clientSecret: stravaClientSecret }
        : {};
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
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
            <p className="text-sm text-text-secondary">
              {credentialsConfigured ? (
                <>Saved in Supabase — Client ID {clientIdMasked ?? '•••'}. Used for daily sync and Connect.</>
              ) : (
                <>Not set. Paste your Strava app credentials below and click Save. Then use Connect to Strava.</>
              )}
            </p>
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
            <button
              type="button"
              onClick={handleSaveCredentials}
              disabled={isSavingCredentials || !stravaClientId.trim() || !stravaClientSecret.trim()}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white p-3 rounded transition-colors font-medium border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingCredentials ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              <span>{isSavingCredentials ? 'Saving...' : 'Save credentials to Supabase'}</span>
            </button>
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
