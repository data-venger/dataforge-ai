import { type SystemHealth } from '../services/aiService';

export function StatusBar({ health }: { health: SystemHealth | null }) {

    const pythonConnected = health?.status === 'ok';
    const ollamaConnected = health?.ollama_connected;

    return (
        <footer className="statusbar">
            <div className="statusbar-left">
                <div className="status-indicator" title={ollamaConnected ? `Model: ${health?.active_model}` : 'Not connected'}>
                    <span className={`status-dot ${ollamaConnected ? 'connected' : 'disconnected'}`} />
                    <span>Ollama {ollamaConnected ? `(${health?.active_model})` : ''}</span>
                </div>
                <div className="status-indicator">
                    <span className="status-dot connected" />
                    <span>DuckDB</span>
                </div>
                <div className="status-indicator" title={pythonConnected ? 'LangChain backend running' : 'Backend offline'}>
                    <span className={`status-dot ${pythonConnected ? 'connected' : 'error'}`} />
                    <span>Python Engine</span>
                </div>
            </div>

            <div className="statusbar-right">
                <span>dataforge.ai v0.1.0</span>
            </div>
        </footer>
    );
}
