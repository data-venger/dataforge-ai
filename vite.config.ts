import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    plugins: [
        react(),
        electron([
            {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        rollupOptions: {
                            external: ['electron'],
                        },
                    },
                },
            },
            {
                entry: 'electron/preload.ts',
                onstart(args) {
                    args.reload();
                },
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        rollupOptions: {
                            external: ['electron'],
                        },
                    },
                },
            },
        ]),
        electronRenderer(),
        // Copy DuckDB WASM files to public so they can be served locally
        viteStaticCopy({
            targets: [
                {
                    src: 'node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm',
                    dest: 'duckdb',
                },
                {
                    src: 'node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm',
                    dest: 'duckdb',
                },
                {
                    src: 'node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js',
                    dest: 'duckdb',
                },
                {
                    src: 'node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js',
                    dest: 'duckdb',
                },
            ],
        }),
    ],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    optimizeDeps: {
        exclude: ['@duckdb/duckdb-wasm'],
    },
});
