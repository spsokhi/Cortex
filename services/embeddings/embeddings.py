"""
Core embedding generation and vector storage logic.
Uses sentence-transformers for embeddings and ChromaDB for vector storage.
"""

import asyncio
import logging
from pathlib import Path
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

logger = logging.getLogger("cortex.embeddings.core")

CHROMA_DB_PATH = Path.home() / ".cortex" / "chroma"


class EmbeddingService:
    def __init__(self, model_name: str = "nomic-ai/nomic-embed-text-v1.5") -> None:
        self.model_name = model_name

        logger.info(f"Loading model: {model_name}")
        self.model = SentenceTransformer(
            model_name,
            trust_remote_code=True,  # Required for nomic-embed-text
        )
        self.dimension = self.model.get_sentence_embedding_dimension()
        logger.info(f"Model loaded — embedding dimension: {self.dimension}")

        # Initialize ChromaDB (persistent, local)
        CHROMA_DB_PATH.mkdir(parents=True, exist_ok=True)
        self.chroma = chromadb.PersistentClient(
            path=str(CHROMA_DB_PATH),
            settings=ChromaSettings(anonymized_telemetry=False),
        )

        # Single collection for all document chunks
        self.collection = self.chroma.get_or_create_collection(
            name="cortex_documents",
            metadata={"hnsw:space": "cosine"},
        )

        logger.info(f"ChromaDB initialized at {CHROMA_DB_PATH}")

    def embed(self, texts: list[str], normalize: bool = True) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []

        # nomic-embed-text uses task-specific prefixes
        prefixed = [f"search_document: {t}" for t in texts]
        embeddings = self.model.encode(
            prefixed,
            normalize_embeddings=normalize,
            show_progress_bar=False,
        )
        return embeddings.tolist()

    def embed_query(self, query: str) -> list[float]:
        """Embed a single search query (uses different prefix for nomic)."""
        prefixed = f"search_query: {query}"
        embedding = self.model.encode(prefixed, normalize_embeddings=True)
        return embedding.tolist()

    async def index_chunks(
        self,
        file_id: str,
        chunks: list[str],
        metadata: dict[str, Any],
    ) -> int:
        """Index a list of text chunks from a file into ChromaDB."""
        if not chunks:
            return 0

        loop = asyncio.get_event_loop()

        # Run embedding in thread pool (CPU-bound)
        embeddings = await loop.run_in_executor(None, self.embed, chunks)

        ids = [f"{file_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {**metadata, "file_id": file_id, "chunk_index": i}
            for i in range(len(chunks))
        ]

        # Delete existing chunks for this file before re-indexing
        await self.delete_file(file_id)

        self.collection.add(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        logger.info(f"Indexed {len(chunks)} chunks for file {file_id}")
        return len(chunks)

    async def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.4,
        file_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Semantic search over indexed document chunks."""
        loop = asyncio.get_event_loop()

        # Embed the query
        query_embedding = await loop.run_in_executor(None, self.embed_query, query)

        # Build ChromaDB where filter
        where = None
        if file_ids:
            where = {"file_id": {"$in": file_ids}}

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k * 2, 20),  # Over-fetch, then filter by score
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        output = []
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for doc, meta, dist in zip(documents, metadatas, distances):
            # ChromaDB returns cosine distance; convert to similarity
            score = 1.0 - dist
            if score < min_score:
                continue

            output.append(
                {
                    "file_id": meta.get("file_id", ""),
                    "chunk_index": meta.get("chunk_index", 0),
                    "content": doc,
                    "score": round(score, 4),
                    "metadata": {k: v for k, v in meta.items() if k not in ("file_id", "chunk_index")},
                }
            )

        # Sort by score descending, cap at top_k
        output.sort(key=lambda x: x["score"], reverse=True)
        return output[:top_k]

    async def delete_file(self, file_id: str) -> None:
        """Remove all chunks for a specific file from the vector store."""
        try:
            results = self.collection.get(where={"file_id": file_id}, include=[])
            if results["ids"]:
                self.collection.delete(ids=results["ids"])
                logger.info(f"Deleted {len(results['ids'])} chunks for file {file_id}")
        except Exception as e:
            logger.warning(f"Error deleting chunks for {file_id}: {e}")
