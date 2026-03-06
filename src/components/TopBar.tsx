import { Search, Bell } from 'lucide-react';
import type { Page } from '../App';

interface TopBarProps {
    activePage: Page;
}

const pageNames: Record<Page, string> = {
    'chat': 'Chat',
    'data-explorer': 'Data Explorer',
    'viz-canvas': 'Visualizations',
    'settings': 'Settings',
};

export function TopBar({ activePage }: TopBarProps) {
    return (
        <header className="topbar">
            <div className="topbar-title">
                <span className="page-name">{pageNames[activePage]}</span>
            </div>

            <div className="topbar-actions">
                <button className="topbar-btn" title="Search">
                    <Search />
                </button>
                <button className="topbar-btn" title="Notifications">
                    <Bell />
                </button>
            </div>
        </header>
    );
}
