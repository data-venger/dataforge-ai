import type { Page } from '../App';
import { DataExplorer } from '../pages/DataExplorer';
import { VizCanvas } from '../pages/VizCanvas';
import { SettingsPage } from '../pages/Settings';

interface MainPanelProps {
    activePage: Page;
}

const pages: Record<Page, React.ComponentType> = {
    'data-explorer': DataExplorer,
    'viz-canvas': VizCanvas,
    'settings': SettingsPage,
};

export function MainPanel({ activePage }: MainPanelProps) {
    return (
        <main className="main-panel">
            {(Object.entries(pages) as [Page, React.ComponentType][]).map(([pageKey, Component]) => (
                <div
                    key={pageKey}
                    className={`page-container ${activePage === pageKey ? 'animate-in' : ''}`}
                    style={{
                        display: activePage === pageKey ? 'flex' : 'none',
                        height: '100%',
                        flexDirection: 'column'
                    }}
                >
                    <Component />
                </div>
            ))}
        </main>
    );
}
