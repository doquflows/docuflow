import { useState } from 'react';
import { ProjectProvider } from './context/ProjectContext';
import Rail from './components/Rail';
import TopBar from './components/TopBar';
import AskView from './views/AskView';
import WikiView from './views/WikiView';
import GraphView from './views/GraphView';
import HealthView from './views/HealthView';
import SyncView from './views/SyncView';
import OnboardView from './views/OnboardView';
import SettingsView from './views/SettingsView';

export default function App() {
  const [view, setView] = useState('query');
  return (
    <ProjectProvider>
      <div className="df-app">
        <div className="df-app__main">
          <Rail view={view} onChange={setView} />
          <div className="df-view">
            <TopBar />
            {view === 'query'   && <AskView />}
            {view === 'wiki'    && <WikiView />}
            {view === 'graph'   && <GraphView />}
            {view === 'health'  && <HealthView />}
            {view === 'sync'    && <SyncView />}
            {view === 'onboard' && <OnboardView />}
            {view === 'settings' && <SettingsView />}          </div>
        </div>
      </div>
    </ProjectProvider>
  );
}
