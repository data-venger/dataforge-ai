import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MainPanel } from './components/MainPanel';
import { StatusBar } from './components/StatusBar';

export type Page = 'chat' | 'data-explorer' | 'viz-canvas' | 'settings';

function App() {
    const [activePage, setActivePage] = useState<Page>('chat');

    return (
        <div className="app-layout">
            <Sidebar activePage={activePage} onNavigate={setActivePage} />
            <div className="app-content">
                <TopBar activePage={activePage} />
                <MainPanel activePage={activePage} />
                <StatusBar />
            </div>
        </div>
    );
}

export default App;
