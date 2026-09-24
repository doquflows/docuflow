import { useState, useRef, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { ICON_MAP } from './Icon';

interface RailProps {
  view: string;
  onChange: (v: string) => void;
}

const RAIL_GROUPS = [
  {
    label: 'EXPLORE',
    items: ['query', 'wiki', 'graph'] as const,
  },
  {
    label: 'MANAGE',
    items: ['health', 'sync', 'onboard', 'settings'] as const,
  },
] as const;

export default function Rail({ view, onChange }: RailProps) {
  const [showProjects, setShowProjects] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProjectPath, setActiveProjectPath] = useState('');
  const { projectInfo, projects, setProjectPath, removeProject, rescanProjects } = useProject();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const syncStatus = projectInfo.syncStatus || 'live';
  const lastIngest = projectInfo.lastIngest || '2h ago';

  // Filter projects based on search query
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Track the active project
  useEffect(() => {
    if (projectInfo.path && projectInfo.path !== activeProjectPath) {
      setActiveProjectPath(projectInfo.path);
    }
  }, [projectInfo.path, activeProjectPath]);

  // Focus search input when projects panel opens
  useEffect(() => {
    if (showProjects && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showProjects]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (showProjects && !target.closest('.df-rail__project-picker')) {
        setShowProjects(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showProjects]);

  return (
    <div className="df-rail">
      {/* Main nav items */}
      <div className="df-rail__groups" style={{ overflowY: 'auto', minHeight: 0 }}>
        {RAIL_GROUPS.map((group, gi) => (
          <div key={gi} className="df-rail__group">
            <div className="df-rail__group-label">{group.label}</div>
            {group.items.map(item => {
              const isActive = view === item;
              
              return (
                <button
                  key={item}
                  className={`df-action ${isActive ? 'df-action--active' : ''}`}
                  onClick={() => onChange(item)}
                  title={item.charAt(0).toUpperCase() + item.slice(1)}
                >
                  {ICON_MAP[item as keyof typeof ICON_MAP] || '●'}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* spacer pushes footer to bottom */}
      <div className="df-rail__spacer" />

      <div className="df-rail__divider" />

      {/* Footer with project management */}
      <div className="df-rail__footer">
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Project picker */}
          <div style={{ position: 'relative' }}>
            <button
              className="df-action df-action--compact"
              onClick={() => setShowProjects(p => !p)}
              title="Projects"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {ICON_MAP.folder}
            </button>
            
            {/* Project list dropdown */}
            {showProjects && (
              <div 
                className="df-rail__project-picker"
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 4px)',
                  left: 0,
                  background: 'var(--df-surface)',
                  border: '1px solid var(--df-border-2)',
                  borderRadius: 'var(--df-r-md)',
                  minWidth: '240px',
                  padding: '8px 0',
                  zIndex: 100,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                }}
              >
                {/* Search box */}
                <div style={{ padding: '0 12px 8px' }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--df-bg)',
                      border: '1px solid var(--df-border-2)',
                      borderRadius: 'var(--df-r-sm)',
                      color: 'var(--df-text)',
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                
                {/* Project list */}
                <div style={{ maxHeight: '240px', overflow: 'auto' }}>
                  {filteredProjects.map(p => (
                    <div
                      key={p.path}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: p.path === activeProjectPath ? 'var(--df-bg-hover)' : 'transparent',
                        borderLeft: p.path === activeProjectPath ? '2px solid var(--df-accent)' : '2px solid transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (p.path !== activeProjectPath) e.currentTarget.style.background = 'var(--df-bg-hover)'; }}
                      onMouseLeave={e => { if (p.path !== activeProjectPath) e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => {
                        setProjectPath(p.path);
                        setActiveProjectPath(p.path);
                        setShowProjects(false);
                        setSearchQuery('');
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--df-text)', fontSize: '12px', fontWeight: 500 }}>
                          {p.name}
                        </div>
                        <div style={{ color: 'var(--df-text-3)', fontSize: '10px', marginTop: '2px' }}>
                          {p.pages} pages · {p.sources} sources
                        </div>
                      </div>
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--df-text-3)',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '2px 4px',
                          borderRadius: 'var(--df-r-sm)',
                          opacity: 0.5,
                          lineHeight: 1,
                        }}
                        title="Remove this project"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProject(p.path);
                          if (activeProjectPath === p.path && filteredProjects.length > 0) {
                            setActiveProjectPath(filteredProjects[0].path);
                          }
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  
                  {filteredProjects.length === 0 && (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--df-text-3)', fontSize: '12px' }}>
                      No projects found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Rescan button */}
          <button
            className="df-action df-action--compact"
            onClick={() => rescanProjects && rescanProjects()}
            title="Rescan projects"
            style={{ opacity: 0.6 }}
          >
            {ICON_MAP.rescan}
          </button>
          
          {/* Status indicator */}
          <div
            className={`df-status-dot df-status-dot--${syncStatus === 'live' ? 'live' : 'paused'}`}
            title={`Status: ${syncStatus}`}
          />
          
          {/* Last Ingest */}
          <div
            style={{
              fontSize: '10px',
              color: 'var(--df-text-3)',
              textAlign: 'center',
              maxWidth: '60px',
              whiteSpace: 'nowrap',
            }}
          >
            {lastIngest}
          </div>
        </div>
      </div>
    </div>
  );
}
