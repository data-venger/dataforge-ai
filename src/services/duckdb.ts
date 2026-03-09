import * as duckdb from '@duckdb/duckdb-wasm';

// Types
export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
}

export interface TableInfo {
    name: string;
    columns: ColumnInfo[];
    rowCount: number;
    sourcePath: string;
    importedAt: number;
}

export interface QueryResult {
    columns: string[];
    columnTypes: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    duration: number;
}

// Singleton DuckDB instance
let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

export async function initDuckDB(): Promise<void> {
    if (db) return;

    // Use local WASM files (copied by vite-plugin-static-copy)
    const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
        mvp: {
            mainModule: new URL('/duckdb/duckdb-mvp.wasm', import.meta.url).href,
            mainWorker: new URL('/duckdb/duckdb-browser-mvp.worker.js', import.meta.url).href,
        },
        eh: {
            mainModule: new URL('/duckdb/duckdb-eh.wasm', import.meta.url).href,
            mainWorker: new URL('/duckdb/duckdb-browser-eh.worker.js', import.meta.url).href,
        },
    };

    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

    const worker = new Worker(
        bundle.mainWorker!,
        { type: 'module' }
    );

    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    conn = await db.connect();

    console.log('[DuckDB] Initialized successfully');
}

export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
    if (!conn) {
        await initDuckDB();
    }
    return conn!;
}

// Import a CSV file into DuckDB
export async function importCSV(
    tableName: string,
    csvContent: string
): Promise<TableInfo> {
    const c = await getConnection();

    // Register the CSV data
    await db!.registerFileText(`${tableName}.csv`, csvContent);

    // Create table from CSV with auto-detection
    await c.query(`
    CREATE OR REPLACE TABLE "${tableName}" AS
    SELECT * FROM read_csv_auto('${tableName}.csv', header=true)
  `);

    return await getTableInfo(tableName);
}

// Import a JSON file into DuckDB
export async function importJSON(
    tableName: string,
    jsonContent: string
): Promise<TableInfo> {
    const c = await getConnection();

    // Pre-process Data: Sometimes "JSON" files are actually dumped Python dictionaries
    // using single quotes (') instead of double quotes ("), and Python booleans (True/False).
    // DuckDB parser requires strict JSON formats.
    let sanitizedContent = jsonContent
        .replace(/^\s*\/\/.*$/gm, '') // Strip JS-style comments just in case
        .replace(/'/g, '"')           // Replace single quotes with double quotes
        .replace(/\bTrue\b/g, 'true') // Fix Python booleans
        .replace(/\bFalse\b/g, 'false')// Fix Python booleans
        .replace(/\bNone\b/g, 'null'); // Fix Python None

    await db!.registerFileText(`${tableName}.json`, sanitizedContent);

    try {
        await c.query(`
        CREATE OR REPLACE TABLE "${tableName}" AS
        SELECT * FROM read_json_auto('${tableName}.json', ignore_errors=true)
        `);
    } catch (error) {
        console.log('[DuckDB] Standard JSON auto-detect failed. Retrying with format array...');
        try {
            await c.query(`
            CREATE OR REPLACE TABLE "${tableName}" AS
            SELECT * FROM read_json_auto('${tableName}.json', format='array', ignore_errors=true)
            `);
        } catch (e2) {
            console.log('[DuckDB] Array format failed. Retrying with newline_delimited...');
            await c.query(`
            CREATE OR REPLACE TABLE "${tableName}" AS
            SELECT * FROM read_json_auto('${tableName}.json', format='newline_delimited', ignore_errors=true)
            `);
        }
    }

    return await getTableInfo(tableName);
}

// Import a Parquet file into DuckDB
export async function importParquet(
    tableName: string,
    data: Uint8Array
): Promise<TableInfo> {
    const c = await getConnection();

    await db!.registerFileBuffer(`${tableName}.parquet`, data);

    await c.query(`
    CREATE OR REPLACE TABLE "${tableName}" AS
    SELECT * FROM read_parquet('${tableName}.parquet')
  `);

    return await getTableInfo(tableName);
}

// Import an Excel file into DuckDB using the spatial extension
export async function importExcel(
    tableName: string,
    data: Uint8Array
): Promise<TableInfo> {
    const c = await getConnection();

    // Load the spatial extension (needed for st_read which handles Excel)
    try {
        await c.query(`INSTALL spatial`);
        await c.query(`LOAD spatial`);
    } catch (e) {
        console.log('[DuckDB] Spatial extension already loaded or unavailable, trying fallback...');
    }

    await db!.registerFileBuffer(`${tableName}.xlsx`, data);

    await c.query(`
    CREATE OR REPLACE TABLE "${tableName}" AS
    SELECT * FROM st_read('${tableName}.xlsx')
  `);

    return await getTableInfo(tableName);
}

// Get table schema and row count
export async function getTableInfo(tableName: string): Promise<TableInfo> {
    const c = await getConnection();

    // Get columns info
    const schemaResult = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = '${tableName}'
    ORDER BY ordinal_position
  `);

    const columns: ColumnInfo[] = [];
    for (let i = 0; i < schemaResult.numRows; i++) {
        columns.push({
            name: String(schemaResult.getChildAt(0)?.get(i)),
            type: String(schemaResult.getChildAt(1)?.get(i)),
            nullable: String(schemaResult.getChildAt(2)?.get(i)) === 'YES',
        });
    }

    // Get row count
    const countResult = await c.query(`SELECT COUNT(*)::INTEGER as cnt FROM "${tableName}"`);
    const rowCount = Number(countResult.getChildAt(0)?.get(0)) || 0;

    return {
        name: tableName,
        columns,
        rowCount,
        sourcePath: '',
        importedAt: Date.now(),
    };
}

// Run a SQL query
export async function runQuery(sql: string): Promise<QueryResult> {
    const c = await getConnection();
    const start = performance.now();

    const result = await c.query(sql);
    const duration = performance.now() - start;

    const columns: string[] = [];
    const columnTypes: string[] = [];
    const schema = result.schema;

    for (const field of schema.fields) {
        columns.push(field.name);
        columnTypes.push(String(field.type));
    }

    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < result.numRows; i++) {
        const row: Record<string, unknown> = {};
        for (let j = 0; j < columns.length; j++) {
            row[columns[j]] = result.getChildAt(j)?.get(i);
        }
        rows.push(row);
    }

    return {
        columns,
        columnTypes,
        rows,
        rowCount: result.numRows,
        duration,
    };
}

// Get a preview of table data (first N rows)
export async function getTablePreview(
    tableName: string,
    limit: number = 100
): Promise<QueryResult> {
    return runQuery(`SELECT * FROM "${tableName}" LIMIT ${limit}`);
}

// List all tables
export async function listTables(): Promise<string[]> {
    const c = await getConnection();
    const result = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'main'
    ORDER BY table_name
  `);

    const tables: string[] = [];
    for (let i = 0; i < result.numRows; i++) {
        tables.push(String(result.getChildAt(0)?.get(i)));
    }
    return tables;
}
