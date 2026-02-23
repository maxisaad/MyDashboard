import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const StravaCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Strava authorization...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');

      if (error) {
        throw new Error('Authorization denied');
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      const clientId = localStorage.getItem('strava_client_id');
      const clientSecret = localStorage.getItem('strava_client_secret');
      const body: { code: string; clientId?: string; clientSecret?: string } = { code };
      if (clientId && clientSecret) {
        body.clientId = clientId;
        body.clientSecret = clientSecret;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-oauth?action=exchange`,
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

      setStatus('success');
      setMessage('Successfully connected to Strava!');

      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error: any) {
      console.error('Callback error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to connect to Strava');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-xl border border-white/5 p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 size={48} className="mx-auto mb-4 animate-spin text-accent-green" />
            <h2 className="text-xl font-bold mb-2">Connecting to Strava</h2>
            <p className="text-text-secondary">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={48} className="mx-auto mb-4 text-accent-green" />
            <h2 className="text-xl font-bold mb-2">Success!</h2>
            <p className="text-text-secondary">{message}</p>
            <p className="text-sm text-text-secondary mt-4">Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold mb-2">Connection Failed</h2>
            <p className="text-text-secondary mb-4">{message}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-accent-green hover:bg-accent-green/90 text-black px-6 py-2 rounded transition-colors font-medium"
            >
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default StravaCallback;
