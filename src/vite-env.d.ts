/// <reference types="vite/client" />

interface FileInfo {
    path: string;
    name: string;
    extension: string;
    size: number;
}

interface FileReadResult {
    data: ArrayBuffer;
    name: string;
    extension: string;
}

interface ElectronAPI {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    getVersion: () => Promise<string>;
    openFileDialog: () => Promise<FileInfo[] | null>;
    readFile: (filePath: string) => Promise<FileReadResult>;
    getApiPort: () => Promise<number>;
    platform: string;
}

interface Window {
    electronAPI: ElectronAPI;
}
