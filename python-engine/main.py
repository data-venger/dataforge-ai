import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from engine.ollama_client import OllamaClient
from engine.vector_store import VectorStore
from engine.sql_chain import SqlChain
from engine.orchestrator import Orchestrator
from engine.document_processor import DocumentProcessor

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
sql_chain = SqlChain(ollama, vector_store)
orchestrator = Orchestrator(ollama, vector_store)
doc_processor = DocumentProcessor(ollama, vector_store)

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

class QueryRequest(BaseModel):
    prompt: str
    active_document: Optional[str] = None

class IndexDocumentRequest(BaseModel):
    source: str
    content: str

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

@app.post("/query")
async def query(req: QueryRequest):
    """Unified entry point for AI queries (SQL, Semantic, Chat)"""
    try:
        result = await orchestrator.ask(req.prompt, active_document=req.active_document)
        return result
    except Exception as e:
        print(f"Error in /query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(req: ChatRequest):
    """Legacy Endpoint: Use /query instead"""
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

@app.post("/index/document")
async def index_document(req: IndexDocumentRequest):
    """Index a text document into the Vector RAG engine"""
    try:
        result = await doc_processor.process_text(req.source, req.content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process/file")
async def process_file(file: UploadFile = File(...)):
    """Process and index an uploaded file (PDF, DOCX, TXT, MD)"""
    try:
        file_bytes = await file.read()
        filename = file.filename or "unknown"
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

        if ext in ('txt', 'md'):
            content = file_bytes.decode('utf-8', errors='ignore')
            result = await doc_processor.process_text(filename, content)
        elif ext == 'pdf':
            result = await doc_processor.process_pdf(filename, file_bytes)
        elif ext == 'docx':
            result = await doc_processor.process_docx(filename, file_bytes)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query/sql")
async def generate_sql(req: QueryRequest):
    """Legacy Endpoint: Use /query instead"""
    try:
        sql = await sql_chain.generate_sql(req.prompt)
        return {"sql": sql}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
