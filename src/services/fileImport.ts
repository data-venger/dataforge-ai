import {
    importCSV,
    importJSON,
    importParquet,
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

// Import a file from the Electron file dialog
export async function importFileFromDialog(): Promise<ImportResult[]> {
    const electronAPI = (window as Window).electronAPI;
    if (!electronAPI) {
        return [{ success: false, error: 'Electron API not available' }];
    }

    const files = await electronAPI.openFileDialog();
    if (!files || files.length === 0) {
        return [];
    }

    const results: ImportResult[] = [];

    for (const file of files) {
        const result = await importSingleFile(file.path, file.name, file.extension);
        results.push(result);
    }

    return results;
}

// Import a single file by path
export async function importSingleFile(
    filePath: string,
    fileName: string,
    extension: string
): Promise<ImportResult> {
    const tableName = toTableName(fileName);

    try {
        const electronAPI = (window as Window).electronAPI;
        const fileData = await electronAPI.readFile(filePath);
        const decoder = new TextDecoder();

        let tableInfo: TableInfo;

        switch (extension) {
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
            case 'parquet': {
                const buffer = new Uint8Array(fileData.data);
                tableInfo = await importParquet(tableName, buffer);
                break;
            }
            default:
                return {
                    success: false,
                    error: `Unsupported file format: .${extension}`,
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
            // We do not fail the import if AI indexing fails
        }

        return { success: true, table: tableInfo };
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
