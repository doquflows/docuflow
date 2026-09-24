import { useState } from 'react';
import { Btn } from '../components/UIKit';
import Icon from '../components/Icon';
import { DOCUFLOW_DATA as D } from '../data/mock';
import { useProject } from '../context/ProjectContext';
import { apiFetch } from '../hooks/useApi';

export default function OnboardView() {
  const { setProjectPath, apiOnline } = useProject();

  const [step, setStep]       = useState(1);
  const [domain, setDomain]   = useState('code');
  const [projectPath, setLocalPath] = useState('');

  // Step 4 init state
  const [initState, setInitState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [initLog, setInitLog]     = useState<string[]>([]);

  const steps = ['Domain', 'Project', 'Source', 'Init'];

  async function handleInit() {
    if (!projectPath.trim() || initState === 'running') return;
    setInitState('running');
    setInitLog([]);
    try {
      const result = await apiFetch<{ ok: boolean; details?: string[]; error?: string }>('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath.trim() }),
      });
      if (result.ok) {
        setInitLog(result.details ?? ['DocuFlow initialized successfully']);
        setInitState('done');
      } else {
        setInitLog([result.error ?? 'Unknown error']);
        setInitState('error');
      }
    } catch (e: unknown) {
      setInitLog([(e as Error).message]);
      setInitState('error');
    }
  }

  function handleOpenProject() {
    setProjectPath(projectPath.trim());
  }

  return (
    <div className="df-onboard">
      <div className="df-onboard__center">
        <div className="df-onboard__inner">
          <div className="df-onboard__steps">
            {steps.map((s, i) => {
              const n = i + 1;
              const state = n < step ? 'done' : n === step ? 'active' : 'idle';
              return (
                <span key={s} style={{ display: 'contents' }}>
                  <div className={`df-onboard__step df-onboard__step--${state}`}>
                    <span className="df-onboard__step-num">
                      {state === 'done' ? <Icon name="check" size={11} /> : n}
                    </span>
                    <span>{s}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`df-onboard__step-line${n < step ? ' df-onboard__step-line--done' : ''}`} />
                  )}
                </span>
              );
            })}
          </div>

          {step === 1 && (
            <div className="df-anim-fade">
              <h1 className="df-h1">What kind of knowledge will live here?</h1>
              <div className="df-onboard__intro">DocuFlow specializes the wiki schema by domain. You can change this later.</div>
              <div className="df-domains">
                {D.domains.map(d => (
                  <button
                    key={d.id}
                    className={`df-domain${domain === d.id ? ' df-domain--selected' : ''}`}
                    onClick={() => setDomain(d.id)}
                  >
                    <div className="df-domain__icon"><Icon name={d.icon} size={16} /></div>
                    <div className="df-domain__label">{d.label}</div>
                    <div className="df-domain__desc">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="df-anim-fade">
              <h1 className="df-h1">Project location</h1>
              <div className="df-onboard__intro">
                Enter the absolute path to your project root. DocuFlow will create{' '}
                <code className="df-code">.docuflow/</code> there.
              </div>
              <div className="df-onboard__fields">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, color: 'var(--df-text-3)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    Project root (absolute path)
                  </label>
                  <input
                    type="text"
                    value={projectPath}
                    onChange={e => setLocalPath(e.target.value)}
                    placeholder="/absolute/path/to/your/project"
                    style={{
                      fontFamily: 'var(--df-font-mono, monospace)',
                      fontSize: 13,
                      padding: '8px 12px',
                      background: 'var(--df-input-bg, var(--df-bg))',
                      border: '1px solid var(--df-border-2)',
                      borderRadius: 'var(--df-r-sm)',
                      color: 'var(--df-text)',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                  {projectPath && (
                    <div style={{ fontSize: 11, color: 'var(--df-text-4)', marginTop: 2 }}>
                      Wiki output: <code className="df-code">{projectPath.trim()}/.docuflow/wiki/</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="df-anim-fade">
              <h1 className="df-h1">Add your first source</h1>
              <div className="df-onboard__intro">Drop a folder, paste a path, or import a repo. We'll ingest non-destructively.</div>
              <div className="df-dropzone">
                <Icon name="folder" size={28} style={{ color: 'var(--df-text-4)' }} />
                <div className="df-dropzone__title">Drop a folder here</div>
                <div className="df-dropzone__sub">…or paste a path · Git repo · zip archive</div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="df-pill df-pill--accent">.docuflow/sources/</span>
                {projectPath
                  ? <span className="df-subtle">{projectPath.trim()}/</span>
                  : <span className="df-subtle">~/code/your-project/src</span>}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="df-anim-fade">
              <h1 className="df-h1">
                {initState === 'idle'    ? 'Ready to initialize'  : ''}
                {initState === 'running' ? 'Initializing…'        : ''}
                {initState === 'done'    ? '✅ Done!'             : ''}
                {initState === 'error'   ? '❌ Initialization failed' : ''}
              </h1>

              {initState === 'idle' && (
                <div className="df-onboard__intro">
                  Will create <code className="df-code">.docuflow/</code> at:{' '}
                  <code className="df-code">{projectPath.trim() || '(no path set — go back to step 2)'}</code>
                </div>
              )}

              {(initState === 'running' || initState === 'done' || initState === 'error') && (
                <div className="df-init-log">
                  {initLog.map((line, i) => (
                    <div key={i} className="df-init-log__line">
                      <span className={`df-init-log__mark--${initState === 'error' ? 'run' : 'ok'}`}>
                        {initState === 'error' ? '✗' : '✓'}
                      </span>
                      <span>{line}</span>
                    </div>
                  ))}
                  {initState === 'running' && (
                    <div className="df-init-log__line">
                      <span className="df-init-log__mark--run">→</span>
                      <span style={{ color: 'var(--df-text-4)' }}>Working…</span>
                    </div>
                  )}
                </div>
              )}

              {initState === 'done' && (
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--df-text-3)' }}>
                  DocuFlow is ready. Click <strong>Open project</strong> to start exploring your wiki.
                </div>
              )}
            </div>
          )}

          <div className="df-onboard__nav">
            <Btn
              variant="ghost"
              onClick={() => { setStep(s => Math.max(1, s - 1)); setInitState('idle'); setInitLog([]); }}
              disabled={step === 1 || initState === 'running'}
            >
              Back
            </Btn>

            {step < 4 ? (
              <Btn
                variant="primary"
                icon="arrow-right"
                onClick={() => setStep(s => s + 1)}
                disabled={step === 2 && !projectPath.trim()}
              >
                Continue
              </Btn>
            ) : initState === 'done' ? (
              <Btn variant="primary" icon="check" onClick={handleOpenProject}>
                Open project
              </Btn>
            ) : (
              <Btn
                variant="primary"
                icon={initState === 'running' ? undefined : 'arrow-right'}
                onClick={handleInit}
                disabled={!projectPath.trim() || !apiOnline || initState === 'running' || initState === 'error'}
              >
                {initState === 'running' ? 'Initializing…' : 'Initialize here'}
              </Btn>
            )}
          </div>

          {step === 4 && !apiOnline && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--df-text-4)', textAlign: 'center' }}>
              API is offline — start the DocuFlow server first (<code className="df-code">docuflow start</code>)
            </div>
          )}
          {step === 4 && initState === 'error' && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <button
                onClick={() => { setInitState('idle'); setInitLog([]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--df-text-4)', textDecoration: 'underline' }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
