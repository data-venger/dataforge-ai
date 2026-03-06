import type { Page } from '../App';
import { ChatPage } from '../pages/ChatPage';
import { DataExplorer } from '../pages/DataExplorer';
import { VizCanvas } from '../pages/VizCanvas';
import { SettingsPage } from '../pages/Settings';

interface MainPanelProps {
    activePage: Page;
}

const pages: Record<Page, React.ComponentType> = {
    'chat': ChatPage,
    'data-explorer': DataExplorer,
    'viz-canvas': VizCanvas,
    'settings': SettingsPage,
};

export function MainPanel({ activePage }: MainPanelProps) {
    const PageComponent = pages[activePage];

    return (
        <main className="main-panel">
            <div className="page-container animate-in" key={activePage}>
                <PageComponent />
            </div>
        </main>
    );
}
