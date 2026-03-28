import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Unlink } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { env } from '../lib/env';

const API_BASE = env.VITE_API_URL;

interface SettingsProps {
  onSyncComplete?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onSyncComplete }) => {
  // Strava state
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLastSync, setGcalLastSync] = useState<string | null>(null);
  const [gcalEventCount, setGcalEventCount] = useState(0);
  const [gcalEnabled, setGcalEnabled] = useState(false);
  const [gcalSyncRunning, setGcalSyncRunning] = useState(false);

  const { addToast } = useToast();

  const loadSettings = useCallback(async () => {
    try {
      const [stravaRes, gcalRes] = await Promise.all([
        fetch(`${API_BASE}/api/settings`),
        fetch(`${API_BASE}/api/gcal/settings`),
      ]);
      if (stravaRes.ok) {
        const data = await stravaRes.json();
        setIsConnected(data.connected);
        setLastSync(data.last_sync_at);
      }
      if (gcalRes.ok) {
        const data = await gcalRes.json();
        setGcalConnected(data.connected);
        setGcalLastSync(data.last_sync_at);
        setGcalEventCount(data.event_count);
        setGcalEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // Handle OAuth callback redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaStatus = params.get('strava');
    const gcalStatus = params.get('gcal');

    if (stravaStatus === 'connected') {
      addToast('Connected to Strava!', 'success');
      window.history.replaceState({}, '', window.location.pathname);
      loadSettings();
      onSyncComplete?.();
    } else if (stravaStatus === 'error') {
      const reason = params.get('reason') || 'unknown';
      addToast(`Strava connection failed: ${reason}`, 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (gcalStatus === 'connected') {
      addToast('Connected to Google Calendar!', 'success');
      window.history.replaceState({}, '', window.location.pathname);
      loadSettings();
      onSyncComplete?.();
    } else if (gcalStatus === 'error') {
      const reason = params.get('reason') || 'unknown';
      addToast(`Google Calendar connection failed: ${reason}`, 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [addToast, loadSettings, onSyncComplete]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // --- Strava handlers ---
  const connectStrava = async () => {
    try {
      const res = await fetch(`${API_BASE}/connect-strava`);
      if (!res.ok) throw new Error('Failed to get auth URL');
      const data = await res.json();
      window.location.href = data.url;
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const triggerSync = async () => {
    setSyncRunning(true);
    try {
      const res = await fetch(`${API_BASE}/sync-now`, { method: 'POST' });
      if (res.status === 202) {
        addToast('Sync started — this may take a minute.', 'info');
        setTimeout(() => {
          loadSettings();
          onSyncComplete?.();
        }, 8000);
      } else if (res.status === 409) {
        addToast('Sync is already running. Please wait.', 'info');
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Unexpected response: ${res.status}`);
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSyncRunning(false);
    }
  };

  const disconnectStrava = async () => {
    if (!confirm('Disconnect Strava? You will need to re-authorize to sync again.')) return;
    try {
      await fetch(`${API_BASE}/strava/disconnect`, { method: 'POST' });
      setIsConnected(false);
      setLastSync(null);
      addToast('Strava disconnected.', 'success');
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  // --- Google Calendar handlers ---
  const connectGcal = async () => {
    try {
      const res = await fetch(`${API_BASE}/connect-gcal`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get auth URL');
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const triggerGcalSync = async () => {
    setGcalSyncRunning(true);
    try {
      const res = await fetch(`${API_BASE}/gcal/sync-now`, { method: 'POST' });
      if (res.status === 202) {
        addToast('Google Calendar sync started.', 'info');
        setTimeout(() => {
          loadSettings();
          onSyncComplete?.();
        }, 5000);
      } else if (res.status === 409) {
        addToast('Google Calendar sync is already running.', 'info');
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Unexpected response: ${res.status}`);
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setGcalSyncRunning(false);
    }
  };

  const disconnectGcal = async () => {
    if (!confirm('Disconnect Google Calendar? All Google events will be removed.')) return;
    try {
      await fetch(`${API_BASE}/gcal/disconnect`, { method: 'POST' });
      setGcalConnected(false);
      setGcalLastSync(null);
      setGcalEventCount(0);
      addToast('Google Calendar disconnected.', 'success');
      onSyncComplete?.();
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  // --- Danger zone ---
  const clearAllData = async () => {
    if (!confirm('Delete ALL local data? This cannot be undone.\n\nType "yes" in the next prompt to confirm.')) return;
    const answer = prompt('Type "yes" to confirm deletion of all data:');
    if (answer !== 'yes') return;
    try {
      const res = await fetch(`${API_BASE}/api/data`, { method: 'DELETE' });
      if (res.ok) {
        addToast('All data deleted.', 'success');
        loadSettings();
        onSyncComplete?.();
      } else {
        throw new Error('Failed to delete data');
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="max-w-md mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Strava Connection */}
        <div className="p-4 rounded-xl bg-card border border-white/5">
          <h3 className="text-lg font-medium mb-4 text-accent-blurple">Strava</h3>

          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-text-secondary">Connection</span>
            <span className={`text-sm font-mono ${isConnected ? 'text-accent-green' : 'text-text-secondary'}`}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-text-secondary">Last Sync</span>
            <span className="text-sm font-mono">{formatLastSync(lastSync)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-text-secondary">Auto Sync</span>
            <span className="text-sm font-mono">Daily at 23:30</span>
          </div>

          <div className="mt-4 space-y-2">
            {!isConnected ? (
              <button
                onClick={connectStrava}
                className="w-full flex items-center justify-center gap-2 bg-[#FC4C02] hover:bg-[#FC4C02]/90 text-white px-4 py-2.5 rounded transition-colors font-medium"
              >
                <ExternalLink size={16} />
                Connect Strava
              </button>
            ) : (
              <>
                <button
                  onClick={triggerSync}
                  disabled={syncRunning}
                  className="w-full flex items-center justify-center gap-2 bg-accent-blurple/10 hover:bg-accent-blurple/20 text-accent-blurple px-4 py-2.5 rounded transition-colors border border-accent-blurple/20 disabled:opacity-50"
                >
                  {syncRunning ? 'Syncing…' : 'Sync Now'}
                </button>
                <button
                  onClick={disconnectStrava}
                  className="w-full flex items-center justify-center gap-2 text-red-400 hover:bg-red-400/10 px-4 py-2 rounded transition-colors text-sm"
                >
                  <Unlink size={14} />
                  Disconnect Strava
                </button>
              </>
            )}
          </div>

          <p className="mt-3 text-xs text-text-secondary">
            Make sure the API server is running on port {API_BASE.split(':').pop()}.
          </p>
        </div>

        {/* Google Calendar Connection */}
        <div className="p-4 rounded-xl bg-card border border-white/5">
          <h3 className="text-lg font-medium mb-4 text-[#4285f4]">Google Calendar</h3>

          {!gcalEnabled ? (
            <div className="text-sm text-text-secondary">
              <p className="mb-2">Google Calendar integration is not configured.</p>
              <p className="text-xs font-mono bg-background rounded p-2 border border-white/5">
                Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-text-secondary">Connection</span>
                <span className={`text-sm font-mono ${gcalConnected ? 'text-accent-green' : 'text-text-secondary'}`}>
                  {gcalConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-text-secondary">Last Sync</span>
                <span className="text-sm font-mono">{formatLastSync(gcalLastSync)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-text-secondary">Events cached</span>
                <span className="text-sm font-mono">{gcalEventCount}</span>
              </div>

              <div className="mt-4 space-y-2">
                {!gcalConnected ? (
                  <button
                    onClick={connectGcal}
                    className="w-full flex items-center justify-center gap-2 bg-[#4285f4] hover:bg-[#4285f4]/90 text-white px-4 py-2.5 rounded transition-colors font-medium"
                  >
                    <ExternalLink size={16} />
                    Connect Google Calendar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={triggerGcalSync}
                      disabled={gcalSyncRunning}
                      className="w-full flex items-center justify-center gap-2 bg-accent-blurple/10 hover:bg-accent-blurple/20 text-accent-blurple px-4 py-2.5 rounded transition-colors border border-accent-blurple/20 disabled:opacity-50"
                    >
                      {gcalSyncRunning ? 'Syncing…' : 'Sync Now'}
                    </button>
                    <button
                      onClick={disconnectGcal}
                      className="w-full flex items-center justify-center gap-2 text-red-400 hover:bg-red-400/10 px-4 py-2 rounded transition-colors text-sm"
                    >
                      <Unlink size={14} />
                      Disconnect Google Calendar
                    </button>
                  </>
                )}
              </div>

              <p className="mt-3 text-xs text-text-secondary">
                Auto-syncs every 30 minutes. Read-only — events can only be edited in Google Calendar.
              </p>
            </>
          )}
        </div>

        {/* Danger Zone */}
        <div className="p-4 rounded-xl bg-card border border-red-500/20">
          <h3 className="text-lg font-medium mb-3 text-red-400">Danger Zone</h3>
          <p className="text-xs text-text-secondary mb-3">
            Delete all local data (activities, events, settings). This cannot be undone.
          </p>
          <button
            onClick={clearAllData}
            className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded transition-colors border border-red-500/20 text-sm"
          >
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
