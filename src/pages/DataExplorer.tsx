import { useState, useEffect, useCallback } from 'react';
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

            // Note: In Electron, File objects from drag-drop have a `path` property
            const files = Array.from(e.dataTransfer.files);
            if (files.length === 0) return;

            setLoadingState('importing');
            setError(null);

            for (const file of files) {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const filePath = (file as File & { path?: string }).path;

                if (filePath) {
                    // Electron: use IPC to read from real path
                    const { importSingleFile } = await import('../services/fileImport');
                    const result = await importSingleFile(filePath, file.name, ext);

                    if (result.success && result.table) {
                        setTables((prev) => {
                            const exists = prev.find((t) => t.name === result.table!.name);
                            if (exists) return prev.map((t) => (t.name === result.table!.name ? result.table! : t));
                            return [...prev, result.table!];
                        });
                        if (!selectedTable) setSelectedTable(result.table.name);
                    } else {
                        setError(result.error || 'Import failed');
                    }
                }
            }

            setLoadingState('idle');
        },
        [dbReady, selectedTable]
    );

    const currentTable = tables.find((t) => t.name === selectedTable);

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

    // Show empty state when no tables
    if (tables.length === 0) {
        return (
            <div
                className={`page-container ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {isDragOver && (
                    <div className="drop-overlay">
                        <div className="drop-overlay-content">
                            <Upload />
                            <span>Drop files to import</span>
                        </div>
                    </div>
                )}
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Database />
                    </div>
                    <h2>Data Explorer</h2>
                    <p>
                        Import CSV, JSON, or Parquet files to start exploring. Drag & drop
                        files here or click Import.
                    </p>
                    <div className="empty-state-actions">
                        <button
                            className="action-btn primary"
                            onClick={handleImport}
                            disabled={loadingState === 'importing'}
                        >
                            {loadingState === 'importing' ? <Loader2 className="spin" /> : <Upload />}
                            <span>{loadingState === 'importing' ? 'Importing...' : 'Import Files'}</span>
                        </button>
                    </div>
                    {error && (
                        <div className="error-banner">
                            <AlertCircle />
                            <span>{error}</span>
                        </div>
                    )}
                    <span className="empty-state-badge">
                        Supports CSV · JSON · Parquet · TSV
                    </span>
                </div>
            </div>
        );
    }

    // Main explorer view
    return (
        <div
            className={`page-container data-explorer ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragOver && (
                <div className="drop-overlay">
                    <div className="drop-overlay-content">
                        <Upload />
                        <span>Drop files to import</span>
                    </div>
                </div>
            )}

            {/* Table List Sidebar */}
            <aside className="explorer-sidebar">
                <div className="explorer-sidebar-header">
                    <h3>Tables</h3>
                    <button
                        className="sidebar-action-btn"
                        onClick={handleImport}
                        title="Import files"
                        disabled={loadingState === 'importing'}
                    >
                        {loadingState === 'importing' ? <Loader2 className="spin" /> : <Upload />}
                    </button>
                </div>

                <div className="table-list">
                    {tables.map((table) => (
                        <button
                            key={table.name}
                            className={`table-list-item ${selectedTable === table.name ? 'active' : ''}`}
                            onClick={() => setSelectedTable(table.name)}
                        >
                            <Table2 className="table-icon" />
                            <div className="table-item-info">
                                <span className="table-name">{table.name}</span>
                                <span className="table-meta">
                                    {table.rowCount.toLocaleString()} rows · {table.columns.length} cols
                                </span>
                            </div>
                            <ChevronRight className="table-chevron" />
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <div className="explorer-content">
                {currentTable ? (
                    <>
                        {/* Schema Section */}
                        <div className="explorer-section schema-section">
                            <div className="section-header">
                                <h3>Schema — {currentTable.name}</h3>
                                <div className="section-actions">
                                    <span className="row-count-badge">
                                        <Rows3 />
                                        {currentTable.rowCount.toLocaleString()} rows
                                    </span>
                                    <button
                                        className="sidebar-action-btn"
                                        onClick={handleRefresh}
                                        title="Refresh"
                                        disabled={loadingState === 'loading'}
                                    >
                                        <RefreshCw className={loadingState === 'loading' ? 'spin' : ''} />
                                    </button>
                                </div>
                            </div>
                            <div className="schema-columns">
                                {currentTable.columns.map((col) => {
                                    const TypeIcon = getTypeIcon(col.type);
                                    return (
                                        <div key={col.name} className="schema-column">
                                            <TypeIcon className="column-type-icon" />
                                            <span className="column-name">{col.name}</span>
                                            <span className="column-type">{col.type}</span>
                                            {col.nullable && <span className="nullable-badge">nullable</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Data Preview Section */}
                        <div className="explorer-section preview-section">
                            <div className="section-header">
                                <h3>Preview</h3>
                                {preview && (
                                    <span className="preview-info">
                                        Showing {preview.rowCount} rows · {preview.duration.toFixed(0)}ms
                                    </span>
                                )}
                            </div>

                            {loadingState === 'loading' ? (
                                <div className="preview-loading">
                                    <Loader2 className="spin" />
                                    <span>Loading data...</span>
                                </div>
                            ) : preview ? (
                                <div className="data-grid-wrapper">
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
                                </div>
                            ) : null}
                        </div>

                        {/* Error display */}
                        {error && (
                            <div className="error-banner">
                                <AlertCircle />
                                <span>{error}</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="empty-state">
                        <p>Select a table to view its schema and data</p>
                    </div>
                )}
            </div>
        </div>
    );
}
