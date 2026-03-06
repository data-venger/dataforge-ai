import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from engine.ollama_client import OllamaClient
from engine.vector_store import VectorStore

app = FastAPI(title="DataForge.ai - Inference Engine")

# Allow Electron renderer to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Fine for local desktop app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
ollama = OllamaClient(model="llama3.2")
vector_store = VectorStore()

# --- Models ---
class ChatRequest(BaseModel):
    prompt: str
    system: Optional[str] = None
    model: Optional[str] = None

class EmbeddingRequest(BaseModel):
    text: str
    model: Optional[str] = None

class IndexSchemaRequest(BaseModel):
    table_name: str
    schema_text: str

# --- Routes ---
@app.get("/health")
async def health_check():
    ollama_ok = await ollama.is_healthy()
    return {
        "status": "ok",
        "ollama_connected": ollama_ok,
        "active_model": ollama.model,
        "vector_store_stats": vector_store.get_stats()
    }

@app.get("/models")
async def get_models():
    models = await ollama.list_models()
    return {"models": models}

@app.post("/chat")
async def chat(req: ChatRequest):
    if req.model:
        ollama.model = req.model
    try:
        response = await ollama.generate(req.prompt, req.system)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embed")
async def embed(req: EmbeddingRequest):
    if req.model:
        ollama.model = req.model
    try:
        embedding = await ollama.get_embedding(req.text)
        return {"embedding": embedding}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/index/schema")
async def index_schema(req: IndexSchemaRequest):
    """Embed and index a SQL table schema for the SQL RAG engine"""
    try:
        embedding = await ollama.get_embedding(req.schema_text)
        vector_store.add_sql_schema(req.table_name, req.schema_text, embedding)
        return {"status": "success", "table": req.table_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
