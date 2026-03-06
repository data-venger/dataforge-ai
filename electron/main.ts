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
            { name: 'Data Files', extensions: ['csv', 'json', 'parquet', 'tsv'] },
            { name: 'CSV', extensions: ['csv', 'tsv'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'Parquet', extensions: ['parquet'] },
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

let pythonProcess: ChildProcess | null = null;

function startPythonEngine() {
    const isWin = process.platform === 'win32';
    const venvBin = isWin ? 'Scripts' : 'bin';
    const pythonExecutable = path.join(__dirname, '../python-engine/venv', venvBin, isWin ? 'python.exe' : 'python');
    const uvicornScript = path.join(__dirname, '../python-engine/venv', venvBin, isWin ? 'uvicorn.exe' : 'uvicorn');

    // In dev, the app is running from the project root.
    const engineDir = path.join(__dirname, '../python-engine');

    console.log('[Electron] Starting Python Engine...');

    try {
        pythonProcess = spawn(uvicornScript, ['main:app', '--host', '127.0.0.1', '--port', '8000'], {
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
