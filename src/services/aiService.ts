export interface SystemHealth {
    status: string;
    ollama_connected: boolean;
    active_model: string;
    vector_store_stats: {
        documents_count: number;
        sql_schemas_count: number;
        storage_path: string;
    };
}

let API_BASE_URL = 'http://127.0.0.1:8000';

class AIService {
    private initialized = false;

    private async ensureInitialized() {
        if (this.initialized) return;
        try {
            if (window.electronAPI && window.electronAPI.getApiPort) {
                const port = await window.electronAPI.getApiPort();
                API_BASE_URL = `http://127.0.0.1:${port}`;
            }
        } catch (e) {
            console.error("Failed to fetch dynamic API port", e);
        }
        this.initialized = true;
    }

    async getHealth(retries = 3): Promise<SystemHealth> {
        await this.ensureInitialized();
        for (let i = 0; i < retries; i++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            try {
                const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error('Failed to fetch health');
                return await res.json();
            } catch (e) {
                clearTimeout(timeoutId);
                if (i === retries - 1) {
                    return {
                        status: 'error',
                        ollama_connected: false,
                        active_model: 'unknown',
                        vector_store_stats: {
                            documents_count: 0,
                            sql_schemas_count: 0,
                            storage_path: '',
                        },
                    };
                }
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        throw new Error("Unreachable");
    }

    async getModels(): Promise<string[]> {
        await this.ensureInitialized();
        try {
            const res = await fetch(`${API_BASE_URL}/models`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.models.map((m: any) => m.name);
        } catch (e) {
            return [];
        }
    }

    async chat(prompt: string, system?: string, model?: string): Promise<string> {
        await this.ensureInitialized();
        const res = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, system, model }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Chat request failed');
        }
        const data = await res.json();
        return data.response;
    }

    async embed(text: string, model?: string): Promise<number[]> {
        await this.ensureInitialized();
        const res = await fetch(`${API_BASE_URL}/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, model }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Embed request failed');
        }
        const data = await res.json();
        return data.embedding;
    }

    async indexSchema(tableName: string, schemaText: string): Promise<boolean> {
        await this.ensureInitialized();
        const res = await fetch(`${API_BASE_URL}/index/schema`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table_name: tableName, schema_text: schemaText }),
        });

        return res.ok;
    }

    async generateSql(question: string): Promise<string> {
        await this.ensureInitialized();
        // Legacy wrapper: calling the dedicated SQL route
        const res = await fetch(`${API_BASE_URL}/query/sql`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: question }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to generate SQL');
        }

        const data = await res.json();
        return data.sql;
    }

    async query(prompt: string, activeDocument?: string | null): Promise<any> {
        await this.ensureInitialized();
        const payload: any = { prompt };

        // If the UI passes a document name that includes the emoji prefix, remove it.
        if (activeDocument) {
            payload.active_document = activeDocument.replace(/^📄\s*/, '');
        }

        const res = await fetch(`${API_BASE_URL}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Query request failed');
        }
        return await res.json();
    }

    async indexDocument(source: string, content: string): Promise<any> {
        const res = await fetch(`${API_BASE_URL}/index/document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, content }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to index document');
        }
        return await res.json();
    }

    async processFile(file: File): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE_URL}/process/file`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to process file');
        }
        return await res.json();
    }
}

export const aiService = new AIService();
