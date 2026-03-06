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

const API_BASE_URL = 'http://127.0.0.1:8000';

class AIService {
    async getHealth(): Promise<SystemHealth> {
        try {
            const res = await fetch(`${API_BASE_URL}/health`);
            if (!res.ok) throw new Error('Failed to fetch health');
            return await res.json();
        } catch (e) {
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
    }

    async getModels(): Promise<string[]> {
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
        const res = await fetch(`${API_BASE_URL}/index/schema`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table_name: tableName, schema_text: schemaText }),
        });

        return res.ok;
    }

    async generateSql(question: string): Promise<string> {
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

    async query(prompt: string): Promise<any> {
        const res = await fetch(`${API_BASE_URL}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Query request failed');
        }
        return await res.json();
    }
}

export const aiService = new AIService();
