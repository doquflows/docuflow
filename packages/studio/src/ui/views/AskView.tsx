import { useState, useEffect, useRef, useCallback } from 'react';
import { Pill, Btn } from '../components/UIKit';
import Icon from '../components/Icon';
import { DOCUFLOW_DATA as D } from '../data/mock';
import { useProject } from '../context/ProjectContext';
import { useApi, apiFetch } from '../hooks/useApi';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AskResponse {
  question:     string;
  answer:       string;
  source_pages: SourcePage[];
  confidence?:  number;
}

interface SourcePage {
  page_id:  string;
  title:    string;
  category: string;
  path?:    string;
  relevance_score?: number;
}

interface WikiPage {
  id:       string;
  title:    string;
  category: string;
}

interface ActivityItem {
  t: string; tool: string; target: string; kind: string; delta: string;
}

type Stage = 'idle' | 'loading' | 'answering' | 'error';

// ── Markdown renderer ─────────────────────────────────────────────────────────
// Converts the multi-line markdown answer from /api/ask into React elements.

function renderAnswerMd(md: string) {
  const lines  = md.split('\n');
  const blocks: JSX.Element[] = [];
  let   key    = 0;
  let   i      = 0;

  const inlineMd = (s: string) =>
    s
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="df-code">$1</code>');

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      blocks.push(<h2 key={key++} className="df-answer__h2">{line.slice(3)}</h2>);
      i++; continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(<h3 key={key++} className="df-answer__h3">{line.slice(4)}</h3>);
      i++; continue;
    }
    // bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="df-answer__ul">
          {items.map((it, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: inlineMd(it) }} />
          ))}
        </ul>
      );
      continue;
    }
    // numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="df-answer__list">
          {items.map((it, j) => (
            <li key={j} className="df-answer__li">
              <span className="df-answer__num">{j + 1}</span>
              <span dangerouslySetInnerHTML={{ __html: inlineMd(it) }} />
            </li>
          ))}
        </ol>
      );
      continue;
    }
    // italic metadata lines (e.g. *Category: entity | Relevance: 90%*)
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      blocks.push(
        <p key={key++} className="df-answer__meta-line">
          {line.slice(1, -1)}
        </p>
      );
      i++; continue;
    }
    // blank line → skip
    if (line.trim() === '') { i++; continue; }
    // regular paragraph
    blocks.push(
      <p key={key++} dangerouslySetInnerHTML={{ __html: inlineMd(line) }} />
    );
    i++;
  }
  return blocks;
}

// ── Suggestion chip generator ─────────────────────────────────────────────────

function buildSuggestions(wikiPages: WikiPage[], projectName: string): string[] {
  // Pick up to 3 entity/concept page titles to build natural questions
  const entities = wikiPages.filter(p =>
    p.category === 'entity' || p.category === 'entities' || p.category === 'entitie'
  ).slice(0, 2);

  const concepts = wikiPages.filter(p =>
    p.category === 'concept' || p.category === 'concepts'
  ).slice(0, 1);

  const suggestions: string[] = [];

  for (const e of entities) {
    suggestions.push(`What is ${e.title} and how is it used?`);
  }
  for (const c of concepts) {
    suggestions.push(`Explain the ${c.title} concept.`);
  }

  // Fallback generic questions if wiki is sparse
  while (suggestions.length < 3) {
    const fallbacks = [
      `What are the key components of ${projectName}?`,
      `How does ${projectName} handle errors?`,
      `What are the main concepts in this project?`,
    ];
    const fb = fallbacks[suggestions.length];
    if (fb && !suggestions.includes(fb)) suggestions.push(fb);
    else break;
  }
  return suggestions.slice(0, 3);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AskView() {
  const { projectPath, projectInfo, apiOnline } = useProject();
  const [stage,    setStage]    = useState<Stage>('idle');
  const [question, setQuestion] = useState('');
  const [result,   setResult]   = useState<AskResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const projectName = projectInfo.name || D.project.name;
  const pageCount   = projectInfo.pages || 0;

  // Activity feed
  const { data: liveActivity } = useApi<ActivityItem[] | null>(
    apiOnline && projectPath ? `/api/activity?path=${encodeURIComponent(projectPath)}` : null,
    null,
  );

  // Load a handful of wiki pages to generate smart suggestion chips
  const { data: wikiData } = useApi<{ pages?: WikiPage[] } | null>(
    apiOnline && projectPath ? `/api/wiki?path=${encodeURIComponent(projectPath)}` : null,
    null,
  );
  const wikiPages: WikiPage[] = wikiData?.pages ?? [];
  const suggestions = buildSuggestions(wikiPages, projectName);

  const reset = useCallback(() => {
    setStage('idle');
    setQuestion('');
    setResult(null);
    setErrorMsg('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const submit = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || !projectPath || !apiOnline) return;
    setQuestion(trimmed);
    setStage('loading');
    setResult(null);
    setErrorMsg('');
    try {
      const res = await apiFetch<AskResponse>('/api/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ path: projectPath, question: trimmed }),
      });
      setResult(res);
      setStage('answering');
    } catch (e: unknown) {
      setErrorMsg((e as Error).message ?? 'Request failed');
      setStage('error');
    }
  }, [projectPath, apiOnline]);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="df-ask">
      <header className="df-ask__header">
        <div className="df-ask__eyebrow">
          <Pill tone="accent"><Icon name="sparkle" size={11} />Ask</Pill>
          <span className="df-subtle">Cited answers from your project's wiki, in seconds.</span>
        </div>
        <h1 className="df-h1 df-h1--display">
          What do you want to know about{' '}
          <span className="df-ask__title-accent">{projectName}</span>?
        </h1>

        <div className="df-ask__box-wrap">
          <div className={`df-ask__box${stage !== 'idle' ? ' df-ask__box--active' : ''}`}>
            <Icon name="search" size={16} style={{ color: 'var(--df-text-4)' }} />

            {stage === 'idle' ? (
              <input
                ref={inputRef}
                className="df-ask__real-input"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit(question); }}
                placeholder={`Ask anything about ${projectName}…`}
                disabled={!apiOnline}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--df-text)', fontFamily: 'inherit', fontSize: 'inherit',
                }}
              />
            ) : (
              <div className="df-ask__box-input">
                <span>{question}</span>
              </div>
            )}

            {stage === 'idle' && (
              <button
                className="df-ask__run"
                onClick={() => submit(question)}
                disabled={!question.trim() || !apiOnline}
                style={{ opacity: (!question.trim() || !apiOnline) ? 0.4 : 1 }}
              >
                <Icon name="sparkle" size={11} />Ask<span className="df-kbd">↩</span>
              </button>
            )}
            {(stage === 'loading' || stage === 'answering' || stage === 'error') && (
              <button className="df-ask__reset" onClick={reset}>New question</button>
            )}
          </div>

          {/* Suggestion chips — dynamic from actual wiki pages */}
          {stage === 'idle' && suggestions.length > 0 && (
            <div className="df-ask__chips">
              {suggestions.map((q, i) => (
                <button
                  key={i}
                  className="df-chip"
                  disabled={!apiOnline}
                  onClick={() => { setQuestion(q); submit(q); }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="df-ask__body">
        <div className="df-ask__main">
          {stage === 'idle'      && <IdleState liveActivity={liveActivity} />}
          {stage === 'loading'   && <LoadingState pageCount={pageCount} />}
          {stage === 'answering' && result && <AnswerState result={result} onAsk={submit} />}
          {stage === 'error'     && <ErrorState msg={errorMsg} onRetry={() => submit(question)} />}
        </div>
        {stage === 'answering' && result && <CitationsRail pages={result.source_pages} />}
      </div>
    </div>
  );
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

function IdleState({ liveActivity }: { liveActivity: ActivityItem[] | null }) {
  const activity = liveActivity && liveActivity.length > 0 ? liveActivity : D.activity;
  const toneFor  = (k: string) =>
    k === 'ingest' ? 'pink' : k === 'query' ? 'accent' : k === 'lint' ? 'amber' : 'default';

  return (
    <div className="df-anim-fade">
      <div className="df-eyebrow" style={{ marginBottom: 14 }}>Recent activity</div>
      <div className="df-card df-card--rows">
        {activity.map((a, i) => (
          <div key={i} className="df-activity__row">
            <span className="df-activity__time">{a.t} ago</span>
            <Pill tone={toneFor(a.kind) as Parameters<typeof Pill>[0]['tone']}>{a.tool}</Pill>
            <span className="df-activity__target">{a.target}</span>
            <span className="df-activity__delta">{a.delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState({ pageCount }: { pageCount: number }) {
  const [step, setStep] = useState(0);
  const stages = [
    `BM25 search across ${pageCount > 0 ? pageCount : '…'} wiki pages`,
    'Re-ranking by recency × relevance',
    'Selecting top sources for synthesis',
    'Composing answer with inline citations',
  ];

  useEffect(() => {
    // Animate steps while waiting for the real API response
    const id = setInterval(() => setStep(s => Math.min(s + 1, stages.length - 1)), 600);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="df-anim-fade">
      <div className="df-search__head">
        <div className="df-search__spinner" />
        <span>Querying wiki…</span>
      </div>
      <div>
        {stages.map((s, i) => {
          const done   = step > i;
          const active = step === i;
          return (
            <div
              key={i}
              className={`df-search__stage${done ? ' df-search__stage--done' : ''}`}
              style={{ color: active ? 'var(--df-accent-text)' : undefined }}
            >
              <Icon name={done ? 'check' : 'dot'} size={11} />
              <span>{s}</span>
            </div>
          );
        })}
      </div>
      <div className="df-search__skel">
        {[100, 92, 78, 64].map((w, i) => (
          <div key={i} className="df-search__skel-bar" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

function AnswerState({ result, onAsk }: { result: AskResponse; onAsk: (q: string) => void }) {
  const sourceCount = result.source_pages.length;
  const confidence  = result.confidence;

  return (
    <div className="df-anim-fade df-answer">
      <div className="df-answer__meta">
        <Pill tone="green"><Icon name="check" size={11} />Answered</Pill>
        {sourceCount > 0 && <Pill tone="accent">{sourceCount} cited source{sourceCount !== 1 ? 's' : ''}</Pill>}
        {confidence != null && <Pill>confidence {(confidence * 100).toFixed(0)}%</Pill>}
      </div>

      <article className="df-answer__doc">
        <h2 className="df-answer__h">{result.question}</h2>
        <div className="df-answer__prose">
          {renderAnswerMd(result.answer)}
        </div>
      </article>

      {sourceCount > 0 && (
        <div className="df-cites">
          <div className="df-eyebrow" style={{ marginBottom: 10, fontFamily: 'var(--df-font-sans)' }}>Sources</div>
          {result.source_pages.map((p, i) => (
            <div key={p.page_id} className="df-cites__row" style={{ animation: `df-fade-in .35s ${0.05 + i * 0.05}s both` }}>
              <span className="df-cites__num">[{i + 1}]</span>
              <div style={{ flex: 1 }}>
                <div className="df-cites__title">{p.title}</div>
                {p.path && <div className="df-cites__path">{p.path}</div>}
              </div>
              <Pill>{normCat(p.category)}</Pill>
              {p.relevance_score != null && (
                <span className="df-cites__path">{p.relevance_score.toFixed(0)}%</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Related questions re-ask chips */}
      <div className="df-actions" style={{ marginTop: 24, flexWrap: 'wrap', gap: 8 }}>
        <Btn icon="plus" variant="primary">Save as wiki page</Btn>
        <Btn icon="cite">Copy with citations</Btn>
        <button
          style={{
            padding: '6px 14px', borderRadius: 'var(--df-r-md)',
            border: '1px solid var(--df-border-2)',
            background: 'none', color: 'var(--df-text-3)',
            fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
          }}
          onClick={() => onAsk(`Follow-up on: ${result.question}`)}
        >
          ↺ Follow-up
        </button>
      </div>
    </div>
  );
}

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="df-anim-fade" style={{ padding: '24px 0' }}>
      <div style={{ color: 'var(--df-red, #f44336)', marginBottom: 12 }}>
        ✗ Could not get an answer
      </div>
      <div style={{ fontSize: 12, color: 'var(--df-text-4)', marginBottom: 16 }}>{msg}</div>
      <button
        onClick={onRetry}
        style={{
          padding: '6px 14px', borderRadius: 'var(--df-r-md)',
          background: 'var(--df-accent)', color: 'var(--df-accent-text)',
          border: 'none', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}

function CitationsRail({ pages }: { pages: SourcePage[] }) {
  if (pages.length === 0) return null;
  return (
    <aside className="df-cites-rail df-anim-fade">
      <div className="df-eyebrow" style={{ marginBottom: 14 }}>Sources</div>
      <div className="df-cites-rail__list">
        {pages.map((p, i) => (
          <div key={p.page_id} className="df-cites-card" style={{ animation: `df-fade-in .4s ${0.1 + i * 0.08}s both` }}>
            <div className="df-cites-card__head">
              <span className="df-cites-card__num">{i + 1}</span>
              <span className="df-cites-card__title">{p.title}</span>
            </div>
            {p.path && <div className="df-cites-card__path">{p.path}</div>}
            <div className="df-cites-card__foot">
              <Pill>{normCat(p.category)}</Pill>
              <span style={{ flex: 1 }} />
              {p.relevance_score != null && (
                <span style={{ color: 'var(--df-accent-text)' }}>{p.relevance_score.toFixed(0)}%</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// Normalise category strings from the API (e.g. "entitie" → "Entity")
function normCat(cat: string): string {
  if (!cat) return 'Page';
  const map: Record<string, string> = {
    entitie: 'Entity', entities: 'Entity', entity: 'Entity',
    concept: 'Concept', concepts: 'Concept',
    timeline: 'Timeline', timelines: 'Timeline',
    synthese: 'Synthesis', syntheses: 'Synthesis', synthesis: 'Synthesis',
  };
  return map[cat.toLowerCase()] ?? (cat.charAt(0).toUpperCase() + cat.slice(1));
}
