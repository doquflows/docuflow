import { Pill, Btn } from '../components/UIKit';
import Icon from '../components/Icon';
import { useProject } from '../context/ProjectContext';
import { useApi } from '../hooks/useApi';
import { DOCUFLOW_DATA as D } from '../data/mock';
import type { PillTone } from '../types';

interface LiveLintIssue {
  type: string;
  page_id: string;
  page_title: string;
  severity: string;
  detail: string;
  suggestion?: string;
}

interface LiveHealth {
  health_score?: number;
  total_pages?: number;
  issues_found?: LiveLintIssue[];
  metrics?: {
    orphan_pages: number;
    stale_pages: number;
    missing_refs: number;
    metadata_gaps: number;
  };
  recommendations?: string[];
}

export default function HealthView() {
  const { projectPath, projectInfo, apiOnline } = useProject();
  const { data: liveHealth } = useApi<LiveHealth | null>(
    apiOnline && projectPath ? `/api/health?path=${encodeURIComponent(projectPath)}` : null,
    null,
  );

  const health = liveHealth?.health_score ?? projectInfo.health ?? D.project.health;
  const totalPages = liveHealth?.total_pages ?? projectInfo.pages ?? D.project.pages;
  const issues = liveHealth?.issues_found ?? [];
  const metrics = liveHealth?.metrics;

  const stats: { label: string; value: number; suffix?: string; tone?: PillTone; caption: string }[] = [
    {
      label: 'Health score', value: health, suffix: '/100', tone: 'green',
      caption: health >= 80 ? 'Good shape' : health >= 50 ? 'Needs attention' : 'Needs work',
    },
    {
      label: 'Wiki pages', value: totalPages,
      caption: `${projectInfo.entities ?? 0} entities`,
    },
    {
      label: 'Stale pages',
      value: metrics?.stale_pages ?? D.lintIssues.filter(i => i.kind === 'stale').length,
      tone: 'amber', caption: 'Source updated, page out of date',
    },
    {
      label: 'Orphan pages',
      value: metrics?.orphan_pages ?? D.lintIssues.filter(i => i.kind === 'orphan').length,
      tone: 'red', caption: 'No inbound links from any page',
    },
  ];

  const trend = [82, 85, 84, 87, 88, 86, 89, 91, 90, 92, 93, 91, 92, health];

  const displayIssues = issues.length > 0
    ? issues.slice(0, 10).map(i => ({
        kind: i.type as 'stale' | 'orphan' | 'meta',
        sev: (i.severity === 'high' ? 'warn' : 'info') as 'warn' | 'info',
        page: i.page_title || i.page_id,
        age: '—',
        msg: i.detail,
      }))
    : D.lintIssues;

  return (
    <div className="df-health">
      <div className="df-eyebrow">Health</div>
      <h1 className="df-h1" style={{ marginTop: 6 }}>Wiki quality at a glance</h1>

      <div className="df-health__grid">
        {stats.map(s => (
          <div key={s.label} className="df-stat">
            <div className="df-eyebrow">{s.label}</div>
            <div className={`df-stat__num${s.tone ? ` df-stat__num--${s.tone}` : ''}`}>
              {s.value}
              {s.suffix && (
                <span style={{ fontSize: 14, color: 'var(--df-text-4)', marginLeft: 4 }}>
                  {s.suffix}
                </span>
              )}
            </div>
            {s.label === 'Health score' && (
              <div className="df-stat__bar">
                <div className="df-stat__bar-fill" style={{ width: `${health}%` }} />
              </div>
            )}
            <div className="df-stat__caption">{s.caption}</div>
          </div>
        ))}
      </div>

      <div className="df-trend">
        <div className="df-trend__head">
          <div className="df-trend__title">Health trend · 14 days</div>
          <Pill tone="green">Score: {health}</Pill>
        </div>
        <div className="df-trend__bars">
          {trend.map((v, i) => (
            <div
              key={i}
              className="df-trend__bar"
              style={{
                height: `${v}%`,
                background: i === trend.length - 1 ? 'var(--df-green)' : 'var(--df-accent-soft)',
                animationDelay: `${i * 40}ms`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="df-eyebrow" style={{ marginBottom: 10 }}>Open issues</div>
      <div className="df-card df-card--rows">
        {displayIssues.length === 0
          ? (
            <div style={{ padding: '16px', color: 'var(--df-text-4)', textAlign: 'center' }}>
              No issues found ✓
            </div>
          )
          : displayIssues.map((iss, i) => (
            <div key={i} className="df-issues__row">
              <Icon
                name={iss.sev === 'warn' ? 'alert' : 'dot'}
                size={14}
                style={{ color: iss.sev === 'warn' ? 'var(--df-amber)' : 'var(--df-text-4)' }}
              />
              <Pill tone={iss.kind === 'stale' ? 'amber' : 'default'}>{iss.kind}</Pill>
              <span className="df-issues__page">{iss.page}</span>
              <span className="df-issues__msg">{iss.msg}</span>
              <span className="df-issues__age">{iss.age}</span>
              <Btn variant="primary">Fix</Btn>
            </div>
          ))
        }
      </div>
    </div>
  );
}
