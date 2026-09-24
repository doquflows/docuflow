import { useState, useEffect } from 'react';
import { Pill } from '../components/UIKit';
import Icon from '../components/Icon';
import { DOCUFLOW_DATA as D } from '../data/mock';
import type { WikiNode } from '../types';
import { useProject } from '../context/ProjectContext';
import { useApi } from '../hooks/useApi';
import { renderInlineMd } from '../lib/markdown';

interface LivePage {
  id: string;
  title: string;
  category: string;
  stale: boolean;
}

interface LiveWiki {
  pages: LivePage[];
  total_pages: number;
}

interface LivePageDetail {
  id: string;
  category: string;
  content: string;
}

export default function WikiView() {
  const [active, setActive] = useState('mod-retry');
  const { projectPath, apiOnline } = useProject();

  const { data: liveWiki } = useApi<LiveWiki | null>(
    apiOnline && projectPath ? `/api/wiki?path=${encodeURIComponent(projectPath)}` : null,
    null,
  );

  // When live pages load, auto-select the first page if current active ID has no match
  useEffect(() => {
    if (liveWiki?.pages && liveWiki.pages.length > 0) {
      const hasMatch = liveWiki.pages.some(p => p.id === active);
      if (!hasMatch) {
        setActive(liveWiki.pages[0].id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveWiki]);

  // Build wiki tree from live data when available
  const treeData: WikiNode[] = liveWiki?.pages && liveWiki.pages.length > 0
    ? buildLiveTree(liveWiki.pages)
    : D.wikiTree;

  // Determine if using live data
  const isLivePage = !!(liveWiki?.pages && liveWiki.pages.length > 0);

  // Fetch the selected page content when using live data
  const { data: livePageDetail, loading: pageLoading } = useApi<LivePageDetail | null>(
    isLivePage && active && !active.startsWith('cat-')
      ? `/api/wiki/${encodeURIComponent(active)}?path=${encodeURIComponent(projectPath)}`
      : null,
    null,
  );

  // Find the live page metadata for the active selection
  const activePage = liveWiki?.pages?.find(p => p.id === active);

  return (
    <div className="df-wiki">
      <Tree data={treeData} active={active} onSelect={setActive} />
      <div className="df-page df-anim-page" key={active}>
        {isLivePage && activePage ? (
          <LivePageDetail
            page={activePage}
            detail={livePageDetail}
            loading={pageLoading}
          />
        ) : (
          <MockPageDetail />
        )}
      </div>
    </div>
  );
}

/** Renders a live wiki page fetched from the API */
function LivePageDetail({
  page,
  detail,
  loading,
}: {
  page: LivePage;
  detail: LivePageDetail | null;
  loading: boolean;
}) {
  return (
    <>
      <div className="df-page__crumb">
        <span>Wiki</span>
        <Icon name="chevron-right" size={11} />
        <span>{page.category}</span>
        <Icon name="chevron-right" size={11} />
        <span className="df-page__crumb-active">{page.title}</span>
      </div>

      <h1 className="df-h1--serif">{page.title}</h1>

      <div className="df-page__meta">
        <Pill tone="accent">{page.category}</Pill>
        {page.stale
          ? <Pill tone="amber"><Icon name="dot" size={10} />stale</Pill>
          : <Pill tone="green"><Icon name="check" size={10} />fresh</Pill>
        }
      </div>

      {loading && (
        <div className="df-page__prose" style={{ color: 'var(--df-text-4)' }}>
          Loading page…
        </div>
      )}

      {!loading && detail?.content && (
        <div
          className="df-page__prose"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(detail.content) }}
        />
      )}

      {!loading && !detail && (
        <div className="df-page__prose" style={{ color: 'var(--df-text-4)' }}>
          Page content not available.
        </div>
      )}
    </>
  );
}

/** Renders the hardcoded mock page (shown when API is offline) */
function MockPageDetail() {
  return (
    <>
      <div className="df-page__crumb">
        <span>Modules</span>
        <Icon name="chevron-right" size={11} />
        <span>billing</span>
        <Icon name="chevron-right" size={11} />
        <span className="df-page__crumb-active">PaymentRetryQueue</span>
      </div>

      <h1 className="df-h1--serif">PaymentRetryQueue</h1>

      <div className="df-page__meta">
        <Pill tone="accent">module</Pill>
        <Pill tone="green"><Icon name="check" size={10} />fresh</Pill>
        <span className="df-page__path">src/billing/retry-queue.ts · 7 inbound · 4 outbound</span>
      </div>

      <div className="df-page__prose">
        <p>
          Manages retry attempts for soft-declined Stripe payments. Implements exponential backoff
          with a 4-attempt ceiling, then transitions the order to{' '}
          <code className="df-code">PAYMENT_FAILED</code> and triggers{' '}
          <a href="#">Dunning Workflow</a>.
        </p>

        <h3 className="df-page__h3">Backoff schedule</h3>
        <div className="df-card" style={{ marginTop: 8 }}>
          {[
            ['Attempt 1', '5 minutes after initial failure'],
            ['Attempt 2', '30 minutes after attempt 1'],
            ['Attempt 3', '4 hours after attempt 2'],
            ['Attempt 4', '24 hours after attempt 3 (final)'],
          ].map(([k, v]) => (
            <div key={k} className="df-page__kv-row">
              <span className="df-page__kv-key">{k}</span>
              <span className="df-page__kv-val">{v}</span>
            </div>
          ))}
        </div>

        <h3 className="df-page__h3">Cross-references</h3>
        <ul>
          <li><a href="#">Stripe Webhook Handler</a> — entry point for decline events</li>
          <li><a href="#">RETRYABLE_DECLINE_CODES</a> — set of codes that route here</li>
          <li><a href="#">LedgerWriter</a> — writes retry attempts to ledger</li>
          <li><a href="#">DunningScheduler</a> — receives final-failure events</li>
        </ul>
      </div>
    </>
  );
}

/** Strip YAML frontmatter (--- ... ---) from markdown content */
function stripFrontmatter(md: string): string {
  const trimmed = md.trimStart();
  if (!trimmed.startsWith('---')) return md;
  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) return md;
  return trimmed.slice(end + 4).trimStart();
}

/** Very simple markdown → HTML renderer for wiki page content */
function renderMarkdown(md: string): string {
  const body = stripFrontmatter(md);
  const lines = body.split('\n');
  const out: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Headings
    if (line.startsWith('### ')) { closeList(); out.push(`<h3 class="df-page__h3">${renderInlineMd(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('## '))  { closeList(); out.push(`<h2 class="df-page__h3">${renderInlineMd(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('# '))   { closeList(); out.push(`<h1 class="df-h1--serif">${renderInlineMd(line.slice(2))}</h1>`); continue; }

    // Unordered list items
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${renderInlineMd(line.slice(2))}</li>`);
      continue;
    }

    // Blank line
    if (line === '') { closeList(); out.push(''); continue; }

    // Paragraph
    closeList();
    out.push(`<p>${renderInlineMd(line)}</p>`);
  }
  closeList();
  return out.join('\n');

  function closeList() {
    if (inList) { out.push('</ul>'); inList = false; }
  }
}

/** Group live pages into category nodes */
function buildLiveTree(pages: LivePage[]): WikiNode[] {
  const CATEGORY_LABELS: Record<string, string> = {
    entity: 'Entities',
    concept: 'Concepts',
    timeline: 'Timelines',
    synthesis: 'Syntheses',
  };

  const groups = new Map<string, LivePage[]>();
  for (const p of pages) {
    const cat = p.category ?? 'entity';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(p);
  }

  const tree: WikiNode[] = [];
  for (const [cat, items] of groups) {
    tree.push({
      id: `cat-${cat}`,
      label: CATEGORY_LABELS[cat] ?? cat,
      kind: 'cat',
      children: items.map(p => ({
        id: p.id,
        label: p.title,
        kind: 'page' as const,
        stale: p.stale,
      })),
    });
  }
  return tree;
}

interface TreeProps {
  data: WikiNode[];
  active: string;
  onSelect: (id: string) => void;
  level?: number;
}

function Tree({ data, active, onSelect, level = 0 }: TreeProps) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.filter(n => n.children).map(n => [n.id, true]))
  );

  if (level === 0) {
    return (
      <aside className="df-tree" aria-label="Wiki navigation">
        <div className="df-tree__filter">
          <Icon name="search" size={11} />
          <span>Filter pages…</span>
        </div>
        {data.map(node => (
          <TreeBranch
            key={node.id}
            node={node}
            level={0}
            active={active}
            onSelect={onSelect}
            open={open}
            setOpen={setOpen}
          />
        ))}
      </aside>
    );
  }
  return null;
}

interface TreeBranchProps {
  node: WikiNode;
  level: number;
  active: string;
  onSelect: (id: string) => void;
  open: Record<string, boolean>;
  setOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

function TreeBranch({ node, level, active, onSelect, open, setOpen }: TreeBranchProps) {
  const isCat = node.kind === 'cat';
  const isOpen = !!open[node.id];
  const isActive = active === node.id;

  if (isCat) {
    return (
      <>
        <div
          className="df-tree__row"
          style={{
            paddingLeft: 8 + level * 12,
            color: level === 0 ? 'var(--df-text-3)' : 'var(--df-text-4)',
            fontWeight: level === 0 ? 600 : 400,
            textTransform: level === 0 ? 'uppercase' : 'none',
            fontSize: level === 0 ? 10 : 12,
            letterSpacing: level === 0 ? '.08em' : 0,
            marginTop: level === 0 ? 8 : 0,
          }}
          onClick={() => setOpen(o => ({ ...o, [node.id]: !o[node.id] }))}
        >
          <span className="df-tree__caret">
            <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={10} />
          </span>
          <span>{node.label}</span>
        </div>
        {isOpen && node.children?.map(c => (
          <TreeBranch
            key={c.id}
            node={c}
            level={level + 1}
            active={active}
            onSelect={onSelect}
            open={open}
            setOpen={setOpen}
          />
        ))}
      </>
    );
  }

  const cls = [
    'df-tree__row',
    isActive && 'df-tree__row--active',
    node.stale && !isActive && 'df-tree__row--stale',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} style={{ paddingLeft: 8 + level * 12 }} onClick={() => onSelect(node.id)}>
      <span className="df-tree__caret"><Icon name="file" size={11} /></span>
      <span style={{ flex: 1 }}>{node.label}</span>
      {node.stale     && <span className="df-tree__indicator df-tree__indicator--stale"     title="Stale"  />}
      {node.highlight && <span className="df-tree__indicator df-tree__indicator--highlight" title="Recent" />}
    </div>
  );
}
