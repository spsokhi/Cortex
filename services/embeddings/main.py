"""
Cortex Embeddings Microservice
Generates dense vector embeddings using local sentence-transformer models.
Serves a FastAPI HTTP interface on localhost:8001 (non-exposed to network).
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from embeddings import EmbeddingService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cortex.embeddings")

embedding_service: EmbeddingService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global embedding_service
    model_name = os.getenv("EMBEDDING_MODEL", "nomic-ai/nomic-embed-text-v1.5")
    logger.info(f"Loading embedding model: {model_name}")
    embedding_service = EmbeddingService(model_name=model_name)
    logger.info("Embedding service ready")
    yield
    logger.info("Embedding service shutting down")


app = FastAPI(
    title="Cortex Embeddings Service",
    description="Local embedding generation — no cloud required",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# Only allow localhost connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class EmbedRequest(BaseModel):
    texts: list[str]
    normalize: bool = True


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    dimension: int


class IndexRequest(BaseModel):
    file_id: str
    chunks: list[str]
    metadata: dict[str, Any] = {}


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    min_score: float = 0.4
    file_ids: list[str] | None = None


class SearchResult(BaseModel):
    file_id: str
    chunk_index: int
    content: str
    score: float
    metadata: dict[str, Any] = {}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "model": embedding_service.model_name if embedding_service else "not loaded"}


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest) -> EmbedResponse:
    if embedding_service is None:
        raise HTTPException(status_code=503, detail="Embedding service not ready")
    if not request.texts:
        raise HTTPException(status_code=400, detail="texts must not be empty")

    try:
        embeddings = embedding_service.embed(request.texts, normalize=request.normalize)
        return EmbedResponse(
            embeddings=embeddings,
            model=embedding_service.model_name,
            dimension=len(embeddings[0]) if embeddings else 0,
        )
    except Exception as e:
        logger.exception("Embedding error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/index")
async def index_file(request: IndexRequest) -> dict[str, Any]:
    if embedding_service is None:
        raise HTTPException(status_code=503, detail="Embedding service not ready")

    try:
        count = await embedding_service.index_chunks(
            file_id=request.file_id,
            chunks=request.chunks,
            metadata=request.metadata,
        )
        return {"file_id": request.file_id, "chunks_indexed": count}
    except Exception as e:
        logger.exception("Indexing error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/search", response_model=list[SearchResult])
async def search(request: SearchRequest) -> list[SearchResult]:
    if embedding_service is None:
        raise HTTPException(status_code=503, detail="Embedding service not ready")

    try:
        results = await embedding_service.search(
            query=request.query,
            top_k=request.top_k,
            min_score=request.min_score,
            file_ids=request.file_ids,
        )
        return [SearchResult(**r) for r in results]
    except Exception as e:
        logger.exception("Search error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.delete("/index/{file_id}")
async def delete_index(file_id: str) -> dict[str, str]:
    if embedding_service is None:
        raise HTTPException(status_code=503, detail="Embedding service not ready")

    await embedding_service.delete_file(file_id)
    return {"file_id": file_id, "status": "deleted"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
