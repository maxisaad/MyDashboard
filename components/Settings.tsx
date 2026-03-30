import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Unlink, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { env } from '../lib/env';
import { IcalSubscription } from '../types';

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

  // iCal state
  const [icalSubs, setIcalSubs] = useState<IcalSubscription[]>([]);
  const [icalShowForm, setIcalShowForm] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [icalName, setIcalName] = useState('');
  const [icalColor, setIcalColor] = useState('#6366f1');
  const [icalAdding, setIcalAdding] = useState(false);
  const [icalSyncRunning, setIcalSyncRunning] = useState(false);
  const [editingSub, setEditingSub] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const ICAL_COLORS = ['#a3e635', '#6366f1', '#a1a1aa', '#f97316', '#ec4899', '#14b8a6', '#4285f4', '#fbbf24'];

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
      // iCal subscriptions
      try {
        const icalRes = await fetch(`${API_BASE}/api/ical/subscriptions`);
        if (icalRes.ok) {
          const data = await icalRes.json();
          setIcalSubs(data.subscriptions || []);
        }
      } catch {}
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

  // --- iCal handlers ---
  const addIcalSub = async () => {
    if (!icalUrl.trim() || !icalName.trim()) return;
    setIcalAdding(true);
    try {
      const res = await fetch(`${API_BASE}/api/ical/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: icalUrl.trim(),
          name: icalName.trim(),
          color: icalColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add subscription');
      addToast(`Added "${icalName}" with ${data.event_count} events.`, 'success');
      setIcalUrl('');
      setIcalName('');
      setIcalShowForm(false);
      loadSettings();
      onSyncComplete?.();
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setIcalAdding(false);
    }
  };

  const deleteIcalSub = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}" and all its events?`)) return;
    try {
      await fetch(`${API_BASE}/api/ical/subscriptions/${id}`, { method: 'DELETE' });
      addToast(`Deleted "${name}".`, 'success');
      loadSettings();
      onSyncComplete?.();
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const updateIcalSub = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/ical/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, color: editColor }),
      });
      setEditingSub(null);
      loadSettings();
      onSyncComplete?.();
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const syncAllIcal = async () => {
    setIcalSyncRunning(true);
    try {
      const res = await fetch(`${API_BASE}/api/ical/sync`, { method: 'POST' });
      if (res.status === 202) {
        addToast('iCal sync started.', 'info');
        setTimeout(() => {
          loadSettings();
          onSyncComplete?.();
        }, 5000);
      } else if (res.status === 409) {
        addToast('iCal sync is already running.', 'info');
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setIcalSyncRunning(false);
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
            <span className="text-sm font-mono">Every 30 min</span>
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

        {/* iCal Subscriptions */}
        <div className="p-4 rounded-xl bg-card border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-[#6366f1]">iCal Subscriptions</h3>
            <button
              onClick={syncAllIcal}
              disabled={icalSyncRunning || icalSubs.length === 0}
              className="p-1.5 hover:bg-white/10 rounded-full disabled:opacity-30"
              title="Sync All"
            >
              <RefreshCw size={16} className={icalSyncRunning ? 'animate-spin' : ''} />
            </button>
          </div>

          {icalSubs.length === 0 && !icalShowForm ? (
            <p className="text-sm text-text-secondary mb-3">No iCal subscriptions yet.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {icalSubs.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                  {editingSub === sub.id ? (
                    <div className="flex-1 flex flex-wrap gap-2 items-center">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        maxLength={50}
                        className="flex-1 min-w-[100px] bg-background border border-white/10 rounded px-2 py-1 text-sm text-white outline-none focus:border-accent-green"
                      />
                      <div className="flex gap-1">
                        {ICAL_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className={`w-5 h-5 rounded-full border-2 ${editColor === c ? 'border-white' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => updateIcalSub(sub.id)}
                        className="text-xs text-accent-green hover:underline"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingSub(null)}
                        className="text-xs text-text-secondary hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{sub.name}</div>
                        <div className="text-xs text-text-secondary">
                          {sub.last_synced_at
                            ? `Synced ${new Date(sub.last_synced_at).toLocaleString()}`
                            : 'Not synced yet'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {sub.sync_status === 'error' && (
                          <AlertTriangle size={14} className="text-amber-400" title="Sync error" />
                        )}
                        <button
                          onClick={() => {
                            setEditingSub(sub.id);
                            setEditName(sub.name);
                            setEditColor(sub.color);
                          }}
                          className="text-xs text-text-secondary hover:text-white px-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteIcalSub(sub.id, sub.name)}
                          className="text-xs text-red-400 hover:text-red-300 px-1"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {icalShowForm ? (
            <div className="space-y-2 p-3 bg-background rounded-lg border border-white/5">
              <div>
                <label className="text-xs text-text-secondary block mb-1">URL (.ics)</label>
                <input
                  type="url"
                  value={icalUrl}
                  onChange={e => setIcalUrl(e.target.value)}
                  placeholder="https://example.com/calendar.ics"
                  className="w-full bg-card border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-accent-green"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Name</label>
                <input
                  type="text"
                  value={icalName}
                  onChange={e => setIcalName(e.target.value)}
                  maxLength={50}
                  placeholder="My Calendar"
                  className="w-full bg-card border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-accent-green"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Color</label>
                <div className="flex gap-1">
                  {ICAL_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setIcalColor(c)}
                      className={`w-6 h-6 rounded-full border-2 ${icalColor === c ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addIcalSub}
                  disabled={!icalUrl.trim() || !icalName.trim() || icalAdding}
                  className="flex-1 bg-accent-blurple hover:bg-accent-blurple/90 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                  {icalAdding ? 'Validating…' : 'Add Calendar'}
                </button>
                <button
                  onClick={() => { setIcalShowForm(false); setIcalUrl(''); setIcalName(''); }}
                  className="px-4 py-2 rounded text-sm text-text-secondary hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIcalShowForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-accent-blurple/10 hover:bg-accent-blurple/20 text-accent-blurple px-4 py-2.5 rounded transition-colors border border-accent-blurple/20 text-sm font-medium"
            >
              <ExternalLink size={14} />
              Add iCal Subscription
            </button>
          )}

          <p className="mt-3 text-xs text-text-secondary">
            Subscribe to any .ics calendar feed. Auto-syncs every 24 hours. Read-only.
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
