import os
import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any

CHROMA_DIR = os.path.expanduser("~/.dataforge/chroma")

class VectorStore:
    def __init__(self):
        os.makedirs(CHROMA_DIR, exist_ok=True)
        self.client = chromadb.PersistentClient(path=CHROMA_DIR)
        
        # Core collections for the RAG engines
        self.doc_collection = self.client.get_or_create_collection("documents")
        self.sql_collection = self.client.get_or_create_collection("sql_schemas")
        
    def add_documents(self, ids: List[str], documents: List[str], embeddings: List[List[float]], metadatas: List[Dict[str, Any]] = None):
        self.doc_collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
        
    def add_sql_schema(self, table_name: str, schema_text: str, embedding: List[float]):
        self.sql_collection.upsert(
            ids=[table_name],
            embeddings=[embedding],
            documents=[schema_text],
            metadatas=[{"table": table_name}]
        )

    def search_documents(self, query_embedding: List[float], n_results: int = 5, source_filter: str = None) -> Dict[str, Any]:
        where = None
        if source_filter:
            where = {"source": source_filter}
            
        return self.doc_collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where
        )

    def search_sql_schemas(self, query_embedding: List[float], n_results: int = 5, table_filter: str = None):
        where = None
        if table_filter:
            where = {"table": table_filter}
        try:
            results = self.sql_collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where
            )
            return results
        except Exception:
            return None

    def get_stats(self) -> Dict[str, Any]:
        return {
            "documents_count": self.doc_collection.count(),
            "sql_schemas_count": self.sql_collection.count(),
            "storage_path": CHROMA_DIR
        }
