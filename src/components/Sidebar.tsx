import {
    Database,
    BarChart3,
    Settings,
    Zap,
} from 'lucide-react';
import type { Page } from '../App';

interface SidebarProps {
    activePage: Page;
    onNavigate: (page: Page) => void;
}

const navItems: { id: Page; icon: typeof Database; label: string }[] = [
    { id: 'data-explorer', icon: Database, label: 'Workspace' },
    { id: 'viz-canvas', icon: BarChart3, label: 'Analytics' },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo" title="DataForge AI">
                <Zap />
            </div>

            <div className="sidebar-divider" />

            {/* Main Navigation */}
            <nav className="sidebar-nav">
                {navItems.map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        className={`sidebar-btn ${activePage === id ? 'active' : ''}`}
                        onClick={() => onNavigate(id)}
                        title={label}
                    >
                        <Icon />
                    </button>
                ))}
            </nav>

            {/* Bottom Actions */}
            <div className="sidebar-bottom">
                <div className="sidebar-divider" />
                <button
                    className={`sidebar-btn ${activePage === 'settings' ? 'active' : ''}`}
                    onClick={() => onNavigate('settings')}
                    title="Settings"
                >
                    <Settings />
                </button>
            </div>
        </aside>
    );
}
