import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Unlink } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8765';

interface SettingsProps {
  onSyncComplete?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onSyncComplete }) => {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const { addToast } = useToast();

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setIsConnected(data.connected);
      setLastSync(data.last_sync_at);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
              <a
                href={`${API_BASE}/connect-strava`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-[#FC4C02] hover:bg-[#FC4C02]/90 text-white px-4 py-2.5 rounded transition-colors font-medium"
              >
                <ExternalLink size={16} />
                Connect Strava
              </a>
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
            Make sure <code className="bg-white/5 px-1 rounded">local_strava_sync.py</code> is running on port {API_BASE.split(':').pop()}.
          </p>
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
