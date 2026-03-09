import re
from typing import Optional, List, Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from engine.ollama_client import OllamaClient
from engine.vector_store import VectorStore
from engine.sql_chain import SqlChain
from engine.vector_chain import VectorChain

class Orchestrator:
    def __init__(self, ollama: OllamaClient, vector_store: VectorStore):
        self.ollama = ollama
        self.vector_store = vector_store
        self.sql_chain = SqlChain(ollama, vector_store)
        self.vector_chain = VectorChain(ollama, vector_store)
        
        # Router Prompt
        self.router_prompt = ChatPromptTemplate.from_template("""You are the query router for DataForge AI. Your job is to classify the user's request into one of three categories:
        
1. 'SQL': If the user asks to query, aggregate, filter, explore tabular data, OR if the request mentions the word "column", "table", "rows", or asks for the meaning of a specific data field.
2. 'SEMANTIC': If the user is asking a conceptual, summary, or knowledge-based question from unstructured text documents (e.g., "who is this resume for", "summarize my research").
3. 'CHAT': For general greetings, help requests, or casual conversation.

User Request: {request}

Classify as one of: SQL, SEMANTIC, CHAT. Return ONLY the single word.
""")
        
    async def ask(self, request: str, active_document: str = None) -> Dict[str, Any]:
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
            return await self.vector_chain.search(request, active_document=active_document)
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

