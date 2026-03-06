import { BarChart3 } from 'lucide-react';

export function VizCanvas() {
    return (
        <div className="page-container">
            <div className="empty-state">
                <div className="empty-state-icon">
                    <BarChart3 />
                </div>
                <h2>Visualization Canvas</h2>
                <p>
                    Charts and dashboards will appear here. Ask questions in the Chat to
                    auto-generate visualizations, or build them manually.
                </p>
                <span className="empty-state-badge accent">
                    <BarChart3 style={{ width: 14, height: 14 }} />
                    Auto-generated from your queries
                </span>
            </div>
        </div>
    );
}
