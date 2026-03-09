import hashlib
from typing import List, Dict, Any, Tuple
from engine.ollama_client import OllamaClient
from engine.vector_store import VectorStore


class DocumentProcessor:
    """Universal document processing pipeline.
    Handles text chunking, embedding, and indexing into ChromaDB.
    """

    CHUNK_SIZE = 500       # characters per chunk
    CHUNK_OVERLAP = 50     # overlap between chunks

    def __init__(self, ollama: OllamaClient, vector_store: VectorStore):
        self.ollama = ollama
        self.vector_store = vector_store

    def chunk_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks."""
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.CHUNK_SIZE
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            start += self.CHUNK_SIZE - self.CHUNK_OVERLAP
        return chunks

    async def process_text(self, source: str, content: str) -> Dict[str, Any]:
        """Process raw text content: chunk, embed, and index."""
        chunks = self.chunk_text(content)

        if not chunks:
            return {"status": "error", "message": "No content to index."}

        ids = []
        documents = []
        embeddings = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            chunk_id = hashlib.md5(f"{source}_{i}_{chunk[:50]}".encode()).hexdigest()
            embedding = await self.ollama.get_embedding(chunk)

            ids.append(chunk_id)
            documents.append(chunk)
            embeddings.append(embedding)
            metadatas.append({"source": source, "chunk_index": i})

        self.vector_store.add_documents(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )

        return {
            "status": "success",
            "source": source,
            "chunks_indexed": len(chunks)
        }

    async def process_pdf(self, source: str, file_bytes: bytes) -> Dict[str, Any]:
        """Extract text from PDF and index it."""
        try:
            from PyPDF2 import PdfReader
            import io

            reader = PdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

            if not text.strip():
                return {"status": "error", "message": "No text could be extracted from PDF."}

            return await self.process_text(source, text)
        except ImportError:
            return {"status": "error", "message": "PyPDF2 is not installed. Run: pip install PyPDF2"}

    async def process_docx(self, source: str, file_bytes: bytes) -> Dict[str, Any]:
        """Extract text from DOCX and index it."""
        try:
            from docx import Document
            import io

            doc = Document(io.BytesIO(file_bytes))
            text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])

            if not text.strip():
                return {"status": "error", "message": "No text could be extracted from DOCX."}

            return await self.process_text(source, text)
        except ImportError:
            return {"status": "error", "message": "python-docx is not installed. Run: pip install python-docx"}
