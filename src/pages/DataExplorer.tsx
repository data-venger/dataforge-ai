import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Database,
    Upload,
    Table2,
    ChevronRight,
    Rows3,
    Hash,
    Type,
    Calendar,
    ToggleLeft,
    FileText,
    RefreshCw,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import { initDuckDB, getTablePreview, getTableInfo, type TableInfo, type QueryResult } from '../services/duckdb';
import { importFileFromDialog } from '../services/fileImport';
import { ChatInterface } from '../components/ChatInterface';

type LoadingState = 'idle' | 'initializing' | 'importing' | 'loading';

// Column type icon mapping
function getTypeIcon(type: string) {
    const t = type.toLowerCase();
    if (t.includes('int') || t.includes('float') || t.includes('double') || t.includes('decimal') || t.includes('numeric'))
        return Hash;
    if (t.includes('varchar') || t.includes('text') || t.includes('char') || t.includes('string'))
        return Type;
    if (t.includes('date') || t.includes('time') || t.includes('timestamp'))
        return Calendar;
    if (t.includes('bool'))
        return ToggleLeft;
    return FileText;
}

export function DataExplorer() {
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [preview, setPreview] = useState<QueryResult | null>(null);

    // Resizing logic for Chat Sidebar
    const [sidebarWidth, setSidebarWidth] = useState(380);
    const isResizing = useRef(false);

    const startResizing = useCallback(() => {
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing.current) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= 250 && newWidth <= Math.max(800, window.innerWidth * 0.6)) {
                setSidebarWidth(newWidth);
            }
        }
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);
    const [loadingState, setLoadingState] = useState<LoadingState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [dbReady, setDbReady] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    // Initialize DuckDB on mount
    useEffect(() => {
        setLoadingState('initializing');
        initDuckDB()
            .then(() => {
                setDbReady(true);
                setLoadingState('idle');
            })
            .catch((err) => {
                setError(`Failed to initialize DuckDB: ${err.message}`);
                setLoadingState('idle');
            });
    }, []);

    // Load preview when table is selected
    useEffect(() => {
        if (!selectedTable || !dbReady) return;

        // Vector RAG documents are not in DuckDB — show info instead
        if (selectedTable.startsWith('📄')) {
            setPreview({
                columns: ['Info'],
                columnTypes: ['VARCHAR'],
                rows: [{ Info: '✅ This document is indexed in the Vector RAG engine. Ask questions about it in the chat!' }],
                rowCount: 1,
                duration: 0,
            });
            setLoadingState('idle');
            return;
        }

        setLoadingState('loading');
        getTablePreview(selectedTable, 100)
            .then((result) => {
                setPreview(result);
                setLoadingState('idle');
            })
            .catch((err) => {
                setError(`Failed to load preview: ${err.message}`);
                setLoadingState('idle');
            });
    }, [selectedTable, dbReady]);

    // Import files handler
    const handleImport = useCallback(async () => {
        if (!dbReady) return;
        setError(null);
        setLoadingState('importing');

        try {
            const results = await importFileFromDialog();

            for (const result of results) {
                if (result.success && result.table) {
                    setTables((prev) => {
                        const exists = prev.find((t) => t.name === result.table!.name);
                        if (exists) {
                            return prev.map((t) => (t.name === result.table!.name ? result.table! : t));
                        }
                        return [...prev, result.table!];
                    });

                    // Auto-select first imported table
                    if (!selectedTable) {
                        setSelectedTable(result.table.name);
                    }
                } else if (!result.success) {
                    setError(result.error || 'Import failed');
                }
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
        } finally {
            setLoadingState('idle');
        }
    }, [dbReady, selectedTable]);

    // Refresh table info
    const handleRefresh = useCallback(async () => {
        if (!selectedTable || !dbReady) return;
        if (selectedTable.startsWith('📄')) return; // Vector RAG docs don't live in DuckDB
        setLoadingState('loading');
        try {
            const info = await getTableInfo(selectedTable);
            setTables((prev) => prev.map((t) => (t.name === selectedTable ? info : t)));
            const result = await getTablePreview(selectedTable, 100);
            setPreview(result);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
        } finally {
            setLoadingState('idle');
        }
    }, [selectedTable, dbReady]);

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
        async (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);

            if (!dbReady) return;

            const files = Array.from(e.dataTransfer.files);
            if (files.length === 0) return;

            setLoadingState('importing');
            setError(null);

            for (const file of files) {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const filePath = (file as File & { path?: string }).path;

                if (filePath) {
                    const { importSingleFile } = await import('../services/fileImport');
                    const result = await importSingleFile(filePath, file.name, ext);

                    if (result.success && result.table) {
                        setTables((prev) => {
                            const exists = prev.find((t) => t.name === result.table!.name);
                            if (exists) {
                                return prev.map((t) => (t.name === result.table!.name ? result.table! : t));
                            }
                            return [...prev, result.table!];
                        });
                        if (!selectedTable) setSelectedTable(result.table.name);
                    } else if (!result.success) {
                        setError(result.error || 'Import failed');
                    }
                }
            }
            setLoadingState('idle');
        },
        [dbReady, selectedTable]
    );

    const selectedTableData = tables.find((t) => t.name === selectedTable);

    // Show loading state while DuckDB initializes
    if (loadingState === 'initializing') {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Loader2 className="spin" />
                    </div>
                    <h2>Initializing DuckDB...</h2>
                    <p>Setting up the analytical query engine</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`unified-workspace animate-in ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragOver && (
                <div className="drop-overlay">
                    <div className="drop-overlay-content">
                        <Upload />
                        <p>Drop data files to import</p>
                    </div>
                </div>
            )}

            <div className="workspace-main">
                <div className="page-container data-explorer">
                    <aside className="explorer-sidebar">
                        <div className="explorer-sidebar-header">
                            <h3>Tables</h3>
                            <div className="sidebar-actions">
                                <button
                                    className="sidebar-action-btn"
                                    onClick={handleImport}
                                    title="Import Data"
                                    disabled={loadingState === 'importing'}
                                >
                                    {loadingState === 'importing' ? (
                                        <Loader2 className="spin" />
                                    ) : (
                                        <Upload />
                                    )}
                                </button>
                                <button
                                    className="sidebar-action-btn"
                                    onClick={handleRefresh}
                                    title="Refresh"
                                    disabled={!selectedTable || loadingState === 'loading'}
                                >
                                    <RefreshCw className={loadingState === 'loading' ? 'spin' : ''} />
                                </button>
                            </div>
                        </div>

                        <div className="table-list">
                            {tables.length === 0 ? (
                                <div className="empty-sidebar">
                                    <p>No tables loaded</p>
                                </div>
                            ) : (
                                tables.map((table) => (
                                    <button
                                        key={table.name}
                                        className={`table-list-item ${selectedTable === table.name ? 'active' : ''}`}
                                        onClick={() => setSelectedTable(table.name)}
                                    >
                                        <Table2 className="table-icon" />
                                        <div className="table-item-info">
                                            <span className="table-name">{table.name}</span>
                                            <span className="table-meta">{table.rowCount.toLocaleString()} rows</span>
                                        </div>
                                        <ChevronRight className="table-chevron" />
                                    </button>
                                ))
                            )}
                        </div>
                    </aside>

                    <main className="explorer-content">
                        {error && (
                            <div className="error-banner">
                                <AlertCircle />
                                <span>{error}</span>
                            </div>
                        )}

                        {!selectedTable ? (
                            <div className="empty-state-container">
                                <div className="chat-welcome-icon">
                                    <Database size={40} />
                                </div>
                                <h2>No Table Selected</h2>
                                <p>Import a CSV, JSON, or Parquet file to start exploring your data locally.</p>
                                <div className="empty-state-actions">
                                    <button
                                        className="action-btn primary"
                                        onClick={handleImport}
                                        disabled={loadingState === 'importing'}
                                    >
                                        {loadingState === 'importing' ? (
                                            <Loader2 className="spin" />
                                        ) : (
                                            <Upload />
                                        )}
                                        Import Data
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <section className="explorer-section schema-section">
                                    <div className="section-header">
                                        <h3>Schema: {selectedTable}</h3>
                                        <div className="row-count-badge">
                                            <Rows3 /> {selectedTableData?.rowCount.toLocaleString()} rows
                                        </div>
                                    </div>
                                    <div className="schema-columns">
                                        {selectedTableData?.columns.map((col) => {
                                            const Icon = getTypeIcon(col.type);
                                            return (
                                                <div key={col.name} className="schema-column">
                                                    <Icon className="column-type-icon" />
                                                    <span className="column-name">{col.name}</span>
                                                    <span className="column-type">{col.type}</span>
                                                    {col.nullable && <span className="nullable-badge">NULL</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section className="explorer-section preview-section">
                                    <div className="section-header">
                                        <h3>Data Preview</h3>
                                        {preview && (
                                            <span className="preview-info">
                                                Showing {preview.rowCount > 100 ? 'first 100' : preview.rowCount} rows
                                            </span>
                                        )}
                                    </div>
                                    <div className="data-grid-wrapper">
                                        {loadingState === 'loading' ? (
                                            <div className="preview-loading">
                                                <Loader2 className="spin" />
                                                <span>Loading preview...</span>
                                            </div>
                                        ) : preview ? (
                                            <table className="data-grid">
                                                <thead>
                                                    <tr>
                                                        <th className="row-num-header">#</th>
                                                        {preview.columns.map((col) => (
                                                            <th key={col}>{col}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {preview.rows.map((row, i) => (
                                                        <tr key={i}>
                                                            <td className="row-num">{i + 1}</td>
                                                            {preview.columns.map((col) => (
                                                                <td key={col}>
                                                                    {row[col] === null ? (
                                                                        <span className="null-value">NULL</span>
                                                                    ) : (
                                                                        String(row[col])
                                                                    )}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : null}
                                    </div>
                                </section>
                            </>
                        )}
                    </main>
                </div>
            </div>

            <div
                className="sidebar-resizer"
                onMouseDown={startResizing}
            />

            <aside className="workspace-chat-sidebar" style={{ width: sidebarWidth, flexBasis: sidebarWidth }}>
                <ChatInterface className="compact" activeContext={selectedTable} />
            </aside>
        </div>
    );
}
