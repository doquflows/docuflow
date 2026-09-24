import { useState } from 'react';
import { Pill, Btn } from '../components/UIKit';
import { DOCUFLOW_DATA as D } from '../data/mock';
import { useProject } from '../context/ProjectContext';
import { useApi, apiFetch } from '../hooks/useApi';
import type { SyncEvent } from '../types';

interface ActivityItem {
  t: string;
  tool: string;
  target: string;
  kind: string;
  delta: string;
}

interface WatchStatus {
  running: boolean;
  pid?: number;
  bridge?: string;
  uptime?: string;
  started_at?: string;
}

interface SyncResult {
  sources_processed: number;
  pages_created: number;
  health_score: number;
  errors: string[];
}

/** Map an activity log item to a SyncEvent-shaped row for the timeline */
function activityToSyncEvent(a: ActivityItem, i: number, total: number): SyncEvent {
  const isLast = i === total - 1;
  const kindMap: Record<string, SyncEvent['kind']> = {
    ingest: 'tool',
    query:  'tool',
    lint:   'tool',
    index:  'tool',
    read:   'tool',
  };
  return {
    t: a.t,
    kind: isLast ? 'done' : (kindMap[a.kind] ?? 'tool'),
    msg: `${a.tool} ${a.target}${a.delta ? ' → ' + a.delta : ''}`,
    files: 0,
  };
}

export default function SyncView() {
  const { projectPath, apiOnline } = useProject();

  // ── Live activity feed ──────────────────────────────────────────────────────
  const { data: liveActivity } = useApi<ActivityItem[] | null>(
    apiOnline && projectPath ? `/api/activity?path=${encodeURIComponent(projectPath)}` : null,
    null,
  );

  // ── Watch daemon status ─────────────────────────────────────────────────────
  const { data: watchStatus, loading: watchLoading } = useApi<WatchStatus | null>(
    apiOnline && projectPath ? `/api/watch/status?path=${encodeURIComponent(projectPath)}` : null,
    null,
  );

  // ── Run Sync state ──────────────────────────────────────────────────────────
  const [syncState, setSyncState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState('');

  // ── Watch toggle state ──────────────────────────────────────────────────────
  const [watchToggling, setWatchToggling] = useState(false);

  async function handleRunSync() {
    if (!projectPath || syncState === 'running') return;
    setSyncState('running');
    setSyncResult(null);
    setSyncError('');
    try {
      const result = await apiFetch<SyncResult>('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath }),
      });
      setSyncResult(result);
      setSyncState('done');
    } catch (e: unknown) {
      setSyncError((e as Error).message);
      setSyncState('error');
    }
  }

  async function handleWatchToggle() {
    if (!projectPath || watchToggling) return;
    setWatchToggling(true);
    try {
      const endpoint = watchStatus?.running ? '/api/watch/stop' : '/api/watch/start';
      await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath }),
      });
      // Brief delay then the useApi hook will re-fetch on next render cycle
      await new Promise(r => setTimeout(r, 1200));
    } catch { /* ignore toggle errors */ } finally {
      setWatchToggling(false);
    }
  }

  // Build timeline rows: use live activity if available, otherwise fall back to mock
  const timelineRows: SyncEvent[] = liveActivity && liveActivity.length > 0
    ? liveActivity.map((a, i) => activityToSyncEvent(a, i, liveActivity.length))
    : D.syncEvents;

  const daemonRunning = watchStatus?.running ?? false;

  return (
    <div className="df-sync">
      <div className="df-sync__head">
        <div>
          <div className="df-eyebrow">Sync</div>
          <h1 className="df-h1" style={{ marginTop: 6 }}>docuflow watch</h1>
          <div className="df-subtle" style={{ marginTop: 6 }}>
            Auto-refresh wiki on every commit. Bridged via your AI agent.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Run Sync — one-shot ingest + index + lint */}
          <Btn
            icon={syncState === 'running' ? 'sync' : 'tool'}
            variant="ghost"
            onClick={handleRunSync}
            disabled={!apiOnline || !projectPath || syncState === 'running'}
          >
            {syncState === 'running' ? 'Syncing…' : 'Run Sync'}
          </Btn>

          {/* Watch daemon stop / start */}
          {apiOnline && (
            <Btn
              icon={daemonRunning ? 'pause' : 'play'}
              variant="primary"
              onClick={handleWatchToggle}
              disabled={watchLoading || watchToggling}
            >
              {watchToggling
                ? (daemonRunning ? 'Stopping…' : 'Starting…')
                : (daemonRunning ? 'Stop daemon' : 'Start daemon')}
            </Btn>
          )}
        </div>
      </div>

      {/* Sync result banner */}
      {syncState === 'done' && syncResult && (
        <div className="df-card" style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', background: 'var(--df-surface)' }}>
          <span style={{ color: 'var(--df-green, #4caf50)', fontSize: 18 }}>✓</span>
          <span style={{ flex: 1 }}>
            Sync complete — <strong>{syncResult.sources_processed}</strong> source(s),{' '}
            <strong>{syncResult.pages_created}</strong> page(s) created,{' '}
            health score <strong>{syncResult.health_score}/100</strong>
          </span>
          {syncResult.errors.length > 0 && (
            <Pill tone="amber">{syncResult.errors.length} error(s)</Pill>
          )}
          <button
            onClick={() => setSyncState('idle')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--df-text-4)', fontSize: 16 }}
          >✕</button>
        </div>
      )}
      {syncState === 'error' && (
        <div className="df-card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--df-red, #f44336)' }}>
          <span>✗ Sync failed: {syncError}</span>
          <button
            onClick={() => setSyncState('idle')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--df-text-4)', fontSize: 16 }}
          >✕</button>
        </div>
      )}

      <div className="df-sync__cards">
        <div className="df-sync-card">
          <div className="df-eyebrow">Status</div>
          <div className="df-sync-card__body">
            <span className={`df-status-dot${daemonRunning ? ' df-status-dot--live' : ' df-status-dot--paused'}`} />
            <span>{daemonRunning ? 'Running' : 'Stopped'}</span>
          </div>
          <div className="df-sync-card__sub">
            {daemonRunning
              ? 'Watching post-commit & post-merge hooks'
              : 'Start daemon to enable auto-sync on commit'}
          </div>
        </div>
        <div className="df-sync-card">
          <div className="df-eyebrow">AI bridge</div>
          <div className="df-sync-card__body">
            {watchStatus?.bridge ?? 'Claude Code · auto'}
          </div>
          <div className="df-sync-card__sub">
            {watchStatus?.bridge
              ? `Active bridge: ${watchStatus.bridge}`
              : 'Detected from .claude/'}
          </div>
        </div>
        <div className="df-sync-card">
          <div className="df-eyebrow">{daemonRunning ? 'Uptime' : 'Last run'}</div>
          <div className="df-sync-card__body">
            {daemonRunning
              ? (watchStatus?.uptime ?? '—')
              : liveActivity && liveActivity.length > 0
                ? `${liveActivity[0].t} ago`
                : '—'}
          </div>
          <div className={`df-sync-card__sub${daemonRunning ? ' df-sync-card__sub--green' : ''}`}>
            {daemonRunning
              ? `PID ${watchStatus?.pid ?? '—'}`
              : liveActivity && liveActivity.length > 0
                ? `${liveActivity.length} operations recorded`
                : 'No recent activity'}
          </div>
        </div>
      </div>

      <div className="df-eyebrow" style={{ marginBottom: 12 }}>Recent activity · timeline</div>
      <div className="df-timeline">
        {timelineRows.map((e, i) => (
          <div key={i} className="df-timeline__row">
            <span className="df-timeline__time">{e.t}</span>
            {i < timelineRows.length - 1 && <div className="df-timeline__line" />}
            <span className={`df-timeline__dot df-timeline__dot--${e.kind}`} />
            <span className={`df-timeline__msg${e.kind === 'done' ? ' df-timeline__msg--done' : ''}`}>{e.msg}</span>
            {e.files > 0 && <Pill>{e.files} {e.files === 1 ? 'file' : 'files'}</Pill>}
          </div>
        ))}
      </div>

    </div>
  );
}
