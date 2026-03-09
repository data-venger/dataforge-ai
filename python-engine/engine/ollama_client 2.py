import httpx
import json
from typing import List, Dict, Any

OLLAMA_BASE_URL = "http://localhost:11434/api"

class OllamaClient:
    def __init__(self, model: str = "llama3.2"):
        self.model = model
    
    async def is_healthy(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get("http://localhost:11434/")
                return res.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(f"{OLLAMA_BASE_URL}/tags")
                res.raise_for_status()
                return res.json().get("models", [])
        except Exception:
            return []

    async def generate(self, prompt: str, system: str = None) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(f"{OLLAMA_BASE_URL}/generate", json=payload)
            res.raise_for_status()
            return res.json().get("response", "")

    async def get_embedding(self, text: str) -> List[float]:
        payload = {
            "model": self.model,
            "prompt": text
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{OLLAMA_BASE_URL}/embeddings", json=payload)
            res.raise_for_status()
            return res.json().get("embedding", [])
