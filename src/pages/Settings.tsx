import { useState, useEffect } from 'react';
import { Cpu, HardDrive, Palette, RefreshCw } from 'lucide-react';
import { aiService, type SystemHealth } from '../services/aiService';

export function SettingsPage() {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadHealth = async () => {
        setIsRefreshing(true);
        const h = await aiService.getHealth();
        setHealth(h);
        setIsRefreshing(false);
    };

    useEffect(() => {
        loadHealth();
    }, []);

    const pythonConnected = health?.status === 'ok';
    const ollamaConnected = health?.ollama_connected;
    const model = health?.active_model || 'None';
    const docCount = health?.vector_store_stats?.documents_count || 0;

    return (
        <div className="page-container">
            <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2>Settings</h2>
                <button
                    className="action-btn"
                    onClick={loadHealth}
                    disabled={isRefreshing}
                    style={{ background: 'transparent', border: '1px solid var(--border-subtle)' }}
                >
                    <RefreshCw className={isRefreshing ? 'spin' : ''} size={16} />
                    <span>Refresh Status</span>
                </button>
            </div>

            <div className="settings-grid">
                {/* AI Engine Settings */}
                <div className="glass-card settings-card">
                    <div className="settings-card-header">
                        <div className="settings-card-icon">
                            <Cpu />
                        </div>
                        <div>
                            <h3>AI Engine</h3>
                            <span className="settings-status">
                                {pythonConnected ? 'Online (FastAPI)' : 'Offline'}
                            </span>
                        </div>
                    </div>
                    <p className="settings-card-desc">Configure Ollama model, embedding model, and inference settings</p>

                    <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                            <span>Ollama Status:</span>
                            <span style={{ color: ollamaConnected ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                                {ollamaConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                            <span>Active Model:</span>
                            <span style={{ color: 'var(--text-primary)' }}>{model}</span>
                        </div>
                    </div>
                </div>

                {/* Data Storage Settings */}
                <div className="glass-card settings-card">
                    <div className="settings-card-header">
                        <div className="settings-card-icon">
                            <HardDrive />
                        </div>
                        <div>
                            <h3>Data Storage</h3>
                            <span className="settings-status">Default</span>
                        </div>
                    </div>
                    <p className="settings-card-desc">Local ChromaDB vector storage and DuckDB analytical cache</p>

                    <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                            <span>Indexed Documents:</span>
                            <span style={{ color: 'var(--text-primary)' }}>{docCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                            <span>Vector Store:</span>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>~/.dataforge/chroma</span>
                        </div>
                    </div>
                </div>

                {/* Appearance Settings */}
                <div className="glass-card settings-card">
                    <div className="settings-card-header">
                        <div className="settings-card-icon">
                            <Palette />
                        </div>
                        <div>
                            <h3>Appearance</h3>
                            <span className="settings-status">Dark mode</span>
                        </div>
                    </div>
                    <p className="settings-card-desc">Theme, font size, and display preferences</p>
                </div>
            </div>
        </div>
    );
}
