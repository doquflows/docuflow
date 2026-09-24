import { useState, useRef, useEffect } from 'react';
import { Btn } from './UIKit';
import Icon from './Icon';
import { useProject } from '../context/ProjectContext';
import { DOCUFLOW_DATA as D } from '../data/mock';

export default function TopBar() {
  const { projectInfo, projects, setProjectPath, apiOnline, addProjectByPath, rescanProjects, removeProject } = useProject();
  const [showPicker, setShowPicker]   = useState(false);
  const [addPath, setAddPath]         = useState('');
  const [addStatus, setAddStatus]     = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [addError, setAddError]       = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [showContext, setShowContext] = useState<null | { x: number; y: number; path: string }>(null);

  const name       = projectInfo.name       || D.project.name;
  const syncStatus = projectInfo.syncStatus || D.project.syncStatus;
  const lastIngest = projectInfo.lastIngest || D.project.lastIngest;

  function openPicker() {
    setShowPicker(p => !p);
    setShowContext(null);
    setAddPath('');
    setAddStatus('idle');
    setAddError('');
  }

  async function handleAddPath() {
    const trimmed = addPath.trim();
    if (!trimmed) return;
    setAddStatus('loading');
    setAddError('');
    const result = await addProjectByPath(trimmed);
    if (result.ok) {
      setAddStatus('ok');
      setAddPath('');
      setTimeout(() => {
        setShowPicker(false);
        setShowContext(null);
        setAddStatus('idle');
      }, 800);
    } else {
      setAddStatus('err');
      setAddError(result.error ?? 'Unknown error');
    }
  }

  function handleRemove(path: string) {
    removeProject(path);
    setShowContext(null);
  }

  function handleContextMenu(ev: React.MouseEvent, path: string) {
    ev.preventDefault();
    setShowContext({ x: ev.clientX, y: ev.clientY, path });
  }

  // Close context menu on click outside
  useEffect(() => {
    function handleMouseDown() { setShowContext(null); }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  return (
    <div className="df-topbar">
      <div className="df-topbar__crumb" style={{ position: 'relative' }}>
        <Icon name="folder" size={13} style={{ color: 'var(--df-text-4)' }} />
        <button
          style={{
            background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'inherit', padding: 0,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          onClick={openPicker}
          title="Switch project or add by path"
        >
          <span style={{ color: 'var(--df-text-3)' }}>{name}</span>
          <Icon name="chevron-down" size={11} style={{ color: 'var(--df-text-4)' }} />
        </button>

        {showPicker && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--df-surface)', border: '1px solid var(--df-border-2)',
            borderRadius: 'var(--df-r-lg)', padding: '4px 0', minWidth: 260,
            zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,.4)',
          }}>
            {projects.map(p => (
              <button
                key={p.path}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 12px', background: 'none', border: 'none',
                  color: p.path === projectInfo.path
                    ? 'var(--df-accent-text)' : 'var(--df-text)',
                  fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
                }}
                onClick={() => { setProjectPath(p.path); setShowPicker(false); setShowContext(null); }}
                onContextMenu={(ev) => handleContextMenu(ev, p.path)}
              >
                {p.name}
                <span style={{ marginLeft: 8, color: 'var(--df-text-4)', fontSize: 10 }}>
                  {p.pages}p
                </span>
              </button>
            ))}

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--df-border-2)', margin: '4px 0' }} />

            {/* Manual path input */}
            <div style={{ padding: '6px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--df-text-4)', marginBottom: 4 }}>
                Add project by path
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  ref={inputRef as any}
                  value={addPath}
                  onChange={e => { setAddPath(e.target.value); setAddStatus('idle'); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddPath(); }}
                  placeholder="/absolute/path/to/project"
                  disabled={addStatus === 'loading'}
                  style={{
                    flex: 1, fontSize: 11, padding: '3px 6px',
                    background: 'var(--df-input-bg, var(--df-bg))',
                    border: '1px solid var(--df-border-2)',
                    borderRadius: 'var(--df-r-sm)', color: 'var(--df-text)',
                    fontFamily: 'inherit', outline: 'none',
                    opacity: addStatus === 'loading' ? 0.6 : 1,
                  }}
                />
                <button
                  onClick={handleAddPath}
                  disabled={addStatus === 'loading' || !addPath.trim()}
                  style={{
                    padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                    background: 'var(--df-accent)', color: 'var(--df-accent-text)',
                    border: 'none', borderRadius: 'var(--df-r-sm)',
                    fontFamily: 'inherit',
                    opacity: (addStatus === 'loading' || !addPath.trim()) ? 0.5 : 1,
                  }}
                >
                  {addStatus === 'loading' ? '…' : 'Add'}
                </button>
              </div>
              {addStatus === 'ok' && (
                <div style={{ fontSize: 10, color: 'var(--df-green, #4caf50)', marginTop: 4 }}>
                  ✓ Project added
                </div>
              )}
              {addStatus === 'err' && (
                <div style={{ fontSize: 10, color: 'var(--df-red, #f44336)', marginTop: 4 }}>
                  ✗ {addError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right-click context menu */}
        {showContext && (
          <div style={{
            position: 'fixed', top: showContext.y + 4, left: showContext.x + 4,
            background: 'var(--df-surface)', border: '1px solid var(--df-border-2)',
            borderRadius: 'var(--df-r-sm)', padding: '2px 0', minWidth: 140,
            zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,.5)',
          }}>
            <button style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '6px 12px', background: 'none', border: 'none',
              color: 'var(--df-red, #f44336)', fontFamily: 'inherit', fontSize: 12
            }} onClick={() => handleRemove(showContext.path)}>
              • Remove
            </button>
          </div>
        )}
      </div>

      <div className="df-topbar__divider" />

      <div className="df-topbar__meta">
        <span className={`df-status-dot df-status-dot--${apiOnline ? 'live' : 'paused'}`} />
        <span>
          {apiOnline
            ? `${syncStatus} · last ingest ${lastIngest}`
            : 'API offline — showing demo data'}
        </span>
      </div>

      <div style={{ flex: 1 }} />
      <Btn icon="search" kbd="⌘K">Search</Btn>
      <Btn icon="tool">Tools</Btn>
      <Btn icon="sync" onClick={() => rescanProjects?.()}>Rescan</Btn>
      <div className="df-topbar__avatar" />
    </div>
  );
}
