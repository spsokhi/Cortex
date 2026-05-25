"""
RAG retriever — delegates embedding + vector search to the embeddings service.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger("cortex.rag.retriever")


class RAGRetriever:
    def __init__(self, embeddings_url: str = "http://127.0.0.1:8001") -> None:
        self.embeddings_url = embeddings_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=30.0)

    async def index_chunks(
        self,
        file_id: str,
        file_name: str,
        chunks: list[str],
        metadata: dict[str, Any] | None = None,
    ) -> int:
        """Send chunks to the embeddings service for indexing."""
        payload = {
            "file_id": file_id,
            "chunks": chunks,
            "metadata": {**(metadata or {}), "file_name": file_name},
        }

        resp = await self.client.post(f"{self.embeddings_url}/index", json=payload)
        resp.raise_for_status()

        data = resp.json()
        return data.get("chunks_indexed", len(chunks))

    async def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.4,
        file_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Search for relevant chunks via the embeddings service."""
        payload: dict[str, Any] = {
            "query": query,
            "top_k": top_k,
            "min_score": min_score,
        }
        if file_ids:
            payload["file_ids"] = file_ids

        try:
            resp = await self.client.post(f"{self.embeddings_url}/search", json=payload)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as e:
            logger.error(f"Search request failed: {e}")
            return []

    async def delete_file(self, file_id: str) -> None:
        """Delete all indexed chunks for a file."""
        try:
            resp = await self.client.delete(f"{self.embeddings_url}/index/{file_id}")
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning(f"Failed to delete file {file_id}: {e}")

    async def close(self) -> None:
        await self.client.aclose()
