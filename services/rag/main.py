"""
Cortex RAG (Retrieval-Augmented Generation) Orchestration Service
Coordinates document retrieval and context injection for chat.
Serves on localhost:8003.
"""

import logging
import os
from contextlib import asynccontextmanager

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from chunker import TextChunker
from retriever import RAGRetriever

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cortex.rag")

EMBEDDINGS_SERVICE = os.getenv("EMBEDDINGS_URL", "http://127.0.0.1:8001")

retriever: RAGRetriever | None = None
chunker: TextChunker | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global retriever, chunker
    chunker = TextChunker(
        chunk_size=int(os.getenv("CHUNK_SIZE", "512")),
        overlap=int(os.getenv("CHUNK_OVERLAP", "64")),
    )
    retriever = RAGRetriever(embeddings_url=EMBEDDINGS_SERVICE)
    logger.info("RAG service ready")
    yield
    logger.info("RAG service shutting down")


app = FastAPI(
    title="Cortex RAG Service",
    description="Local RAG orchestration — context retrieval for AI chat",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


class IndexRequest(BaseModel):
    file_id: str
    file_name: str
    text: str
    metadata: dict = {}


class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = 5
    min_score: float = 0.4
    file_ids: list[str] | None = None


class ContextChunk(BaseModel):
    file_id: str
    file_name: str
    content: str
    score: float
    chunk_index: int


class RAGQueryResponse(BaseModel):
    context: list[ContextChunk]
    query: str
    total_tokens: int


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/index")
async def index_document(request: IndexRequest) -> dict:
    """Chunk a document and send its chunks to the embeddings service for indexing."""
    if chunker is None or retriever is None:
        raise HTTPException(status_code=503, detail="RAG service not ready")

    chunks = chunker.chunk(request.text)
    if not chunks:
        return {"file_id": request.file_id, "chunks": 0, "status": "empty"}

    try:
        result = await retriever.index_chunks(
            file_id=request.file_id,
            file_name=request.file_name,
            chunks=chunks,
            metadata=request.metadata,
        )
        return {"file_id": request.file_id, "chunks": len(chunks), "status": "indexed"}
    except Exception as e:
        logger.exception("Indexing failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/retrieve", response_model=RAGQueryResponse)
async def retrieve_context(request: RAGQueryRequest) -> RAGQueryResponse:
    """Retrieve relevant document chunks for a user query."""
    if retriever is None:
        raise HTTPException(status_code=503, detail="RAG service not ready")

    try:
        results = await retriever.search(
            query=request.query,
            top_k=request.top_k,
            min_score=request.min_score,
            file_ids=request.file_ids,
        )

        chunks = [
            ContextChunk(
                file_id=r["file_id"],
                file_name=r.get("metadata", {}).get("file_name", "Unknown"),
                content=r["content"],
                score=r["score"],
                chunk_index=r["chunk_index"],
            )
            for r in results
        ]

        total_tokens = sum(len(c.content.split()) for c in chunks)

        return RAGQueryResponse(
            context=chunks,
            query=request.query,
            total_tokens=total_tokens,
        )
    except Exception as e:
        logger.exception("Retrieval failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/augment")
async def augment_prompt(query: str, file_ids: list[str] | None = None) -> dict:
    """Return an augmented prompt with retrieved context injected."""
    if retriever is None:
        raise HTTPException(status_code=503, detail="RAG service not ready")

    results = await retriever.search(query=query, top_k=5, file_ids=file_ids)

    if not results:
        return {"augmented_prompt": query, "context_used": False, "sources": []}

    context_parts = []
    for i, r in enumerate(results, 1):
        fname = r.get("metadata", {}).get("file_name", "document")
        context_parts.append(f"[Source {i}: {fname}]\n{r['content']}")

    context_block = "\n\n".join(context_parts)
    augmented = (
        f"Use the following context to answer the question.\n\n"
        f"CONTEXT:\n{context_block}\n\n"
        f"QUESTION: {query}\n\n"
        f"Answer based on the context above. If the context doesn't contain "
        f"the answer, say so clearly."
    )

    return {
        "augmented_prompt": augmented,
        "context_used": True,
        "sources": [
            {
                "file_id": r["file_id"],
                "file_name": r.get("metadata", {}).get("file_name", ""),
                "score": r["score"],
                "chunk_index": r["chunk_index"],
            }
            for r in results
        ],
    }


@app.delete("/index/{file_id}")
async def delete_document(file_id: str) -> dict:
    if retriever is None:
        raise HTTPException(status_code=503, detail="RAG service not ready")

    await retriever.delete_file(file_id)
    return {"file_id": file_id, "status": "deleted"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8003"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
