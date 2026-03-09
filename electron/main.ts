import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

process.env.DIST_ELECTRON = path.join(__dirname);
process.env.DIST = path.join(process.env.DIST_ELECTRON, '../dist');
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
    ? path.join(process.env.DIST_ELECTRON, '../public')
    : process.env.DIST;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        frame: false,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 16 },
        backgroundColor: '#0a0e17',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load the app
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC Handlers — Window
ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.handle('window:close', () => {
    mainWindow?.close();
});

ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});

// IPC Handlers — File Operations
ipcMain.handle('file:openDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'All Supported', extensions: ['csv', 'tsv', 'json', 'jsonl', 'parquet', 'xlsx', 'xls', 'txt', 'md', 'pdf', 'docx'] },
            { name: 'Structured Data', extensions: ['csv', 'tsv', 'json', 'jsonl', 'parquet', 'xlsx', 'xls'] },
            { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'docx'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    // Return file info for each selected file
    const files = result.filePaths.map((filePath) => {
        const stats = fs.statSync(filePath);
        return {
            path: filePath,
            name: path.basename(filePath),
            extension: path.extname(filePath).toLowerCase().slice(1),
            size: stats.size,
        };
    });

    return files;
});

ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
        const buffer = fs.readFileSync(filePath);
        return {
            data: buffer.buffer,
            name: path.basename(filePath),
            extension: path.extname(filePath).toLowerCase().slice(1),
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to read file: ${message}`);
    }
});

import { spawn, type ChildProcess } from 'child_process';
import { createServer } from 'net';

let pythonProcess: ChildProcess | null = null;
let apiPort: number = 8000;

ipcMain.handle('app:getApiPort', () => apiPort);

async function getAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.on('error', (err) => {
            reject(err);
        });
        // Listen on port 0 to let the OS assign a random free port
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (address && typeof address === 'object') {
                const port = address.port;
                server.close(() => resolve(port));
            } else {
                server.close(() => reject(new Error('Failed to get port from OS')));
            }
        });
    });
}

async function startPythonEngine() {
    apiPort = await getAvailablePort(8000);
    const isWin = process.platform === 'win32';
    const isPackaged = app.isPackaged;

    const engineDir = isPackaged
        ? path.join(process.resourcesPath, 'python-engine')
        : path.join(__dirname, '../python-engine');

    const venvBin = isWin ? 'Scripts' : 'bin';
    const pythonExec = isWin ? 'python.exe' : 'python3';

    // Check if bundled venv exists, otherwise fallback to global python
    const bundledPython = path.join(engineDir, 'venv', venvBin, pythonExec);
    const useBundled = fs.existsSync(bundledPython);

    const command = useBundled ? bundledPython : (isWin ? 'python' : 'python3');
    const args = ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', apiPort.toString()];

    console.log(`[Electron] Starting Python Engine on port ${apiPort}...`);
    console.log(`[Electron] Command: ${command} ${args.join(' ')}`);
    console.log(`[Electron] CWD: ${engineDir}`);

    try {
        pythonProcess = spawn(command, args, {
            cwd: engineDir,
            stdio: 'inherit'
        });

        pythonProcess.on('error', (err) => {
            console.error('[Electron] Failed to start Python process:', err);
        });

        pythonProcess.on('exit', (code) => {
            console.log(`[Electron] Python process exited with code ${code}`);
            pythonProcess = null;
        });
    } catch (e) {
        console.error('[Electron] Error spawning python:', e);
    }
}

function stopPythonEngine() {
    if (pythonProcess) {
        console.log('[Electron] Stopping Python Engine...');
        pythonProcess.kill('SIGTERM');
        pythonProcess = null;
    }
}

// App lifecycle
app.whenReady().then(() => {
    startPythonEngine();
    createWindow();
});

app.on('before-quit', () => {
    stopPythonEngine();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
