import {
    importCSV,
    importJSON,
    importParquet,
    importExcel,
    type TableInfo,
} from './duckdb';
import { aiService } from './aiService';

export interface ImportResult {
    success: boolean;
    table?: TableInfo;
    error?: string;
}

// Sanitize filename into a valid table name
function toTableName(filename: string): string {
    return filename
        .replace(/\.[^.]+$/, '')        // remove extension
        .replace(/[^a-zA-Z0-9_]/g, '_') // replace special chars
        .replace(/^(\d)/, '_$1')        // prefix if starts with digit
        .toLowerCase();
}

// Import a file via Electron dialog OR web file input (browser fallback)
export async function importFileFromDialog(): Promise<ImportResult[]> {
    const electronAPI = (window as Window).electronAPI;

    if (electronAPI) {
        // Electron mode: use native dialog
        const files = await electronAPI.openFileDialog();
        if (!files || files.length === 0) return [];

        const results: ImportResult[] = [];
        for (const file of files) {
            const result = await importSingleFile(file.path, file.name, file.extension);
            results.push(result);
        }
        return results;
    }

    // Web/Browser mode: use HTML file input
    return new Promise<ImportResult[]>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.csv,.tsv,.json,.jsonl,.parquet,.xlsx,.xls,.txt,.md,.pdf,.docx';
        input.onchange = async () => {
            if (!input.files || input.files.length === 0) {
                resolve([]);
                return;
            }

            const results: ImportResult[] = [];
            for (const file of Array.from(input.files)) {
                const result = await importWebFile(file);
                results.push(result);
            }
            resolve(results);
        };
        input.click();
    });
}

// Import a file from the browser File API (no Electron)
export async function importWebFile(file: File): Promise<ImportResult> {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const tableName = toTableName(file.name);

    // Unstructured → Vector RAG
    if (['txt', 'md'].includes(ext)) {
        try {
            const content = await file.text();
            const result = await aiService.indexDocument(file.name, content);
            return {
                success: true,
                table: {
                    name: `📄 ${file.name}`,
                    columns: [{ name: 'content', type: 'TEXT (Vector RAG)', nullable: false }],
                    rowCount: result.chunks_indexed || 0,
                    sourcePath: file.name,
                    importedAt: Date.now(),
                },
            };
        } catch (e: unknown) {
            return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
        }
    }

    if (['pdf', 'docx'].includes(ext)) {
        try {
            const result = await aiService.processFile(file);
            return {
                success: true,
                table: {
                    name: `📄 ${file.name}`,
                    columns: [{ name: 'content', type: 'TEXT (Vector RAG)', nullable: false }],
                    rowCount: result.chunks_indexed || 0,
                    sourcePath: file.name,
                    importedAt: Date.now(),
                },
            };
        } catch (e: unknown) {
            return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
        }
    }

    // Structured → DuckDB
    try {
        let tableInfo: TableInfo;

        switch (ext) {
            case 'csv':
            case 'tsv': {
                const text = await file.text();
                tableInfo = await importCSV(tableName, text);
                break;
            }
            case 'json':
            case 'jsonl': {
                const text = await file.text();
                tableInfo = await importJSON(tableName, text);
                break;
            }
            case 'parquet': {
                const buffer = new Uint8Array(await file.arrayBuffer());
                tableInfo = await importParquet(tableName, buffer);
                break;
            }
            case 'xlsx':
            case 'xls': {
                const buffer = new Uint8Array(await file.arrayBuffer());
                tableInfo = await importExcel(tableName, buffer);
                break;
            }
            default:
                return { success: false, error: `Unsupported format: .${ext}` };
        }

        tableInfo.sourcePath = file.name;

        // Auto-index schema
        try {
            const schemaText = tableInfo.columns.map((c) => `${c.name} (${c.type})`).join(', ');
            const fullSchema = `CREATE TABLE ${tableName} (\n  ${schemaText}\n);`;
            await aiService.indexSchema(tableName, fullSchema);
        } catch (e) {
            console.error(`[AI Engine] Failed to index schema:`, e);
        }

        return { success: true, table: tableInfo };
    } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

// Import a single file by path
export async function importSingleFile(
    filePath: string,
    fileName: string,
    extension: string
): Promise<ImportResult> {
    const tableName = toTableName(fileName);
    const ext = extension.toLowerCase();

    // Unstructured formats → Vector RAG Engine
    if (['txt', 'md'].includes(ext)) {
        return importTextToVectorRAG(filePath, fileName);
    }
    if (['pdf', 'docx'].includes(ext)) {
        return importBinaryToVectorRAG(filePath, fileName);
    }

    // Structured formats → DuckDB SQL Engine
    try {
        const electronAPI = (window as Window).electronAPI;
        const fileData = await electronAPI.readFile(filePath);
        const decoder = new TextDecoder();

        let tableInfo: TableInfo;

        switch (ext) {
            case 'csv':
            case 'tsv': {
                const text = decoder.decode(fileData.data);
                tableInfo = await importCSV(tableName, text);
                break;
            }
            case 'json': {
                const text = decoder.decode(fileData.data);
                tableInfo = await importJSON(tableName, text);
                break;
            }
            case 'jsonl': {
                const text = decoder.decode(fileData.data);
                tableInfo = await importJSON(tableName, text);
                break;
            }
            case 'parquet': {
                const buffer = new Uint8Array(fileData.data);
                tableInfo = await importParquet(tableName, buffer);
                break;
            }
            case 'xlsx':
            case 'xls': {
                // Excel: register file buffer and use DuckDB spatial extension
                const buffer = new Uint8Array(fileData.data);
                tableInfo = await importExcel(tableName, buffer);
                break;
            }
            default:
                return {
                    success: false,
                    error: `Unsupported file format: .${ext}`,
                };
        }

        tableInfo.sourcePath = filePath;

        // Auto-index the schema into the AI Vector Store
        try {
            const schemaText = tableInfo.columns
                .map((c) => `${c.name} (${c.type})`)
                .join(', ');
            const fullSchema = `CREATE TABLE ${tableName} (\n  ${schemaText}\n);`;
            await aiService.indexSchema(tableName, fullSchema);
            console.log(`[AI Engine] Indexed schema for ${tableName}`);
        } catch (e) {
            console.error(`[AI Engine] Failed to index schema for ${tableName}:`, e);
        }

        return { success: true, table: tableInfo };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: message };
    }
}

// Import text/md files into Vector RAG (not DuckDB)
async function importTextToVectorRAG(filePath: string, fileName: string): Promise<ImportResult> {
    try {
        const electronAPI = (window as Window).electronAPI;
        const fileData = await electronAPI.readFile(filePath);
        const decoder = new TextDecoder();
        const content = decoder.decode(fileData.data);

        const result = await aiService.indexDocument(fileName, content);
        console.log(`[Vector RAG] Indexed ${fileName}: ${result.chunks_indexed} chunks`);

        return {
            success: true,
            table: {
                name: `📄 ${fileName}`,
                columns: [{ name: 'content', type: 'TEXT (Vector RAG)', nullable: false }],
                rowCount: result.chunks_indexed || 0,
                sourcePath: filePath,
                importedAt: Date.now(),
            },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: message };
    }
}

// Import PDF/DOCX via Python backend processing
async function importBinaryToVectorRAG(filePath: string, fileName: string): Promise<ImportResult> {
    try {
        const electronAPI = (window as Window).electronAPI;
        const fileData = await electronAPI.readFile(filePath);

        const blob = new Blob([fileData.data]);
        const file = new File([blob], fileName);
        const result = await aiService.processFile(file);
        console.log(`[Vector RAG] Processed ${fileName}: ${result.chunks_indexed} chunks`);

        return {
            success: true,
            table: {
                name: `📄 ${fileName}`,
                columns: [{ name: 'content', type: 'TEXT (Vector RAG)', nullable: false }],
                rowCount: result.chunks_indexed || 0,
                sourcePath: filePath,
                importedAt: Date.now(),
            },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: message };
    }
}


// Format file size for display
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
