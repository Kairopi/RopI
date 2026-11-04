/**
 * Muse API Status Component
 * 
 * Shows Meta Muse API connection status and configuration
 */

import { useState, useEffect } from 'react';
import { RefreshCw } from '@/components/icons';
import { getMuseStatus, isMuseConfigured } from '@/lib/api/muse';

export function MuseApiStatus() {
  const [status, setStatus] = useState<{
    configured: boolean;
    connected: boolean;
    error?: string;
    loading: boolean;
  }>({
    configured: false,
    connected: false,
    loading: true,
  });

  const checkStatus = async () => {
    setStatus(prev => ({ ...prev, loading: true }));
    
    try {
      const result = await getMuseStatus();
      setStatus({
        ...result,
        loading: false,
      });
    } catch (error) {
      setStatus({
        configured: false,
        connected: false,
        error: error instanceof Error ? error.message : 'Failed to check status',
        loading: false,
      });
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const tone = status.loading
    ? { dot: 'bg-muted-foreground/40', text: 'Checking Meta Muse' }
    : !status.configured
      ? { dot: 'bg-warning', text: 'Meta Muse not configured' }
      : status.connected
        ? { dot: 'bg-success', text: 'Meta Muse connected' }
        : { dot: 'bg-destructive', text: 'Meta Muse unreachable' };

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button
        onClick={checkStatus}
        disabled={status.loading}
        title={status.error ?? 'Check the Meta Muse connection again'}
        className="group inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:border-primary/40"
      >
        <span className="relative flex h-2 w-2">
          {status.connected && !status.loading && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40" />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${tone.dot}`} />
        </span>
        {tone.text}
        <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${status.loading ? 'animate-spin' : 'opacity-0 group-hover:opacity-100'}`} />
      </button>
      {!status.loading && !status.configured && (
        <p className="max-w-sm text-[12.5px] text-warning-ink">
          Add <code className="num rounded bg-warning/15 px-1">VITE_MUSE_API_KEY</code> to <code className="num">.env</code> and restart the dev
          server. Built-in quizzes and rule-based parsing still work.
        </p>
      )}
      {!status.loading && status.configured && !status.connected && status.error && (
        <p className="max-w-sm truncate text-[12.5px] text-destructive">{status.error}</p>
      )}
    </div>
  );
}
