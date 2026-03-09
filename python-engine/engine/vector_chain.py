from typing import List, Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from engine.ollama_client import OllamaClient
from engine.vector_store import VectorStore


class VectorChain:
    """Semantic retrieval + answer synthesis using ChromaDB documents."""

    def __init__(self, ollama: OllamaClient, vector_store: VectorStore):
        self.ollama = ollama
        self.vector_store = vector_store

        self.qa_prompt = ChatPromptTemplate.from_template("""You are DataForge AI, an intelligent data assistant. 
Answer the user's question based ONLY on the context provided below.
If the question asks about a person's identity, look carefully for names, contact info, or headers at the top of the text. 
If the context does not contain enough information, say so honestly.

## Context (retrieved from indexed documents):
{context}

## User Question:
{question}

## Answer:""")

    async def search(self, question: str, active_document: str = None) -> Dict[str, Any]:
        # 1. Embed the question
        query_embedding = await self.ollama.get_embedding(question)

        # 2. Search ChromaDB collections (both text documents and schemas)
        doc_results = self.vector_store.search_documents(query_embedding, n_results=5, source_filter=active_document)
        schema_results = self.vector_store.search_sql_schemas(query_embedding, n_results=3, table_filter=active_document)

        documents = []
        sources = []
        
        # Add text chunks
        if doc_results and doc_results.get("documents") and doc_results["documents"][0]:
            documents.extend(doc_results["documents"][0])
            if doc_results.get("metadatas") and doc_results["metadatas"][0]:
                sources.extend([m.get("source", "unknown") for m in doc_results["metadatas"][0]])
                
        # Add SQL Schemas (useful if the user is asking about structured columns)
        if schema_results and schema_results.get("documents") and schema_results["documents"][0]:
            schemas = schema_results["documents"][0]
            for s in schemas:
                documents.append(f"Structured Table Schema Context:\n{s}")
            if schema_results.get("metadatas") and schema_results["metadatas"][0]:
                sources.extend([m.get("table", "unknown") for m in schema_results["metadatas"][0]])

        if not documents:
            # Fallback to general LLM response if no relevant chunks are found
            fallback_prompt = ChatPromptTemplate.from_template("""You are DataForge AI, an intelligent data assistant.
The user asked a question, but there are no specific document contents available to answer it directly.
Answer the question using your general knowledge. Be helpful and concise.

User Question:
{question}
""")
            response = await self.ollama.generate(prompt=fallback_prompt.format(question=question))
            return {
                "type": "semantic",
                "text": response,
                "sources": []
            }

        # 3. Build context from retrieved chunks
        context = "\n\n---\n\n".join(documents)

        # 4. Generate answer using Ollama
        prompt_val = self.qa_prompt.format(context=context, question=question)
        response = await self.ollama.generate(prompt=prompt_val)

        return {
            "type": "semantic",
            "text": response,
            "sources": list(set(sources))
        }
