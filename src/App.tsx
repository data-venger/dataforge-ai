import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MainPanel } from './components/MainPanel';
import { StatusBar } from './components/StatusBar';
import { aiService, type SystemHealth } from './services/aiService';

export type Page = 'data-explorer' | 'viz-canvas' | 'settings';

function App() {
    const [activePage, setActivePage] = useState<Page>('data-explorer');
    const [health, setHealth] = useState<SystemHealth | null>(null);

    useEffect(() => {
        aiService.getHealth().then(setHealth);
        const interval = setInterval(async () => {
            const h = await aiService.getHealth();
            setHealth(h);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const isError = health && (health.status === 'error' || !health.ollama_connected);

    return (
        <div className="app-layout">
            <Sidebar activePage={activePage} onNavigate={setActivePage} />
            <div className="app-content">
                <TopBar activePage={activePage} />
                <MainPanel activePage={activePage} />
                <StatusBar health={health} />
            </div>

            {isError && (
                <div className="global-error-overlay">
                    <div className="global-error-modal">
                        <h3>⚠️ Connection Error</h3>
                        <p>DataForge AI cannot connect to its required backend services.</p>
                        <ul>
                            {!health?.ollama_connected && <li><strong>Ollama</strong> is offline. Please start the Ollama application.</li>}
                            {health?.status === 'error' && <li><strong>Python Engine</strong> is unreachable.</li>}
                        </ul>
                        <button onClick={() => window.location.reload()}>Retry Connection</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
