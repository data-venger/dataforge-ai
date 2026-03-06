import re
from typing import Optional, List, Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from engine.ollama_client import OllamaClient
from engine.vector_store import VectorStore
from engine.sql_chain import SqlChain

class Orchestrator:
    def __init__(self, ollama: OllamaClient, vector_store: VectorStore):
        self.ollama = ollama
        self.vector_store = vector_store
        self.sql_chain = SqlChain(ollama, vector_store)
        
        # Router Prompt
        self.router_prompt = ChatPromptTemplate.from_template("""You are the query router for DataForge AI. Your job is to classify the user's request into one of three categories:
        
1. 'SQL': If the user is asking to query, aggregate, filter, or explore tabular data (e.g., "how many rows", "average price", "show top 10").
2. 'SEMANTIC': If the user is asking a conceptual, summary, or knowledge-based question that doesn't belong in a specific SQL table (e.g., "what is the theme of these notes", "summarize my research").
3. 'CHAT': For general greetings, help requests, or casual conversation.

User Request: {request}

Classify as one of: SQL, SEMANTIC, CHAT. Return ONLY the single word.
""")
        
        # Router Chain (using LCEL where possible with the custom client wrapper)
        # Note: Since OllamaClient is a custom wrapper, we handle the async calls manually 
        # but structured as a logic flow.
        
    async def ask(self, request: str) -> Dict[str, Any]:
        # 1. Classify Intent
        intent = await self._classify_intent(request)
        
        if intent == "SQL":
            sql = await self.sql_chain.generate_sql(request)
            return {
                "type": "sql",
                "sql": sql,
                "text": "I've generated a SQL query based on your request."
            }
        elif intent == "SEMANTIC":
            # Placeholder for Vector RAG Engine
            return {
                "type": "chat",
                "text": "I've identified this as a semantic search request. The Vector RAG engine is currently being initialized."
            }
        else:
            # General Chat
            response = await self.ollama.generate(
                prompt=request, 
                system="You are DataForge AI, a helpful local data assistant. Keep responses professional and concise."
            )
            return {
                "type": "chat",
                "text": response
            }

    async def _classify_intent(self, request: str) -> str:
        prompt = self.router_prompt.format(request=request)
        response = await self.ollama.generate(prompt=prompt)
        
        clean_response = response.upper().strip()
        if "SQL" in clean_response:
            return "SQL"
        if "SEMANTIC" in clean_response:
            return "SEMANTIC"
        return "CHAT"
