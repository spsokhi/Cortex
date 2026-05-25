"""
Text chunking strategies for RAG document indexing.
Supports fixed-size chunking with overlap and sentence-aware chunking.
"""

import re
from typing import Iterator


class TextChunker:
    """
    Splits text into overlapping chunks of approximately chunk_size words,
    preferring to break at sentence or paragraph boundaries.
    """

    def __init__(self, chunk_size: int = 512, overlap: int = 64) -> None:
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk(self, text: str) -> list[str]:
        """Split text into chunks, returning a list of chunk strings."""
        text = self._clean(text)
        if not text:
            return []

        paragraphs = self._split_paragraphs(text)
        chunks: list[str] = []
        current_words: list[str] = []

        for para in paragraphs:
            words = para.split()
            if not words:
                continue

            # If adding this paragraph would exceed chunk_size, flush first
            if len(current_words) + len(words) > self.chunk_size and current_words:
                chunks.append(" ".join(current_words))
                # Keep overlap
                current_words = current_words[-self.overlap:] if self.overlap > 0 else []

            current_words.extend(words)

            # If current chunk is over limit, flush it
            while len(current_words) >= self.chunk_size:
                chunks.append(" ".join(current_words[: self.chunk_size]))
                current_words = current_words[self.chunk_size - self.overlap :]

        # Flush remaining
        if current_words:
            chunks.append(" ".join(current_words))

        # Filter out very short chunks (likely noise)
        return [c for c in chunks if len(c.split()) >= 10]

    def chunk_iter(self, text: str) -> Iterator[tuple[int, str]]:
        """Yield (index, chunk) tuples."""
        for i, chunk in enumerate(self.chunk(text)):
            yield i, chunk

    def _clean(self, text: str) -> str:
        """Normalize whitespace and remove null bytes."""
        text = text.replace("\x00", "")
        text = re.sub(r"\r\n", "\n", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _split_paragraphs(self, text: str) -> list[str]:
        """Split on blank lines, preserving paragraph structure."""
        return [p.strip() for p in text.split("\n\n") if p.strip()]


class PDFChunker(TextChunker):
    """Extended chunker that preserves page information from PDF text."""

    def chunk_pages(self, pages: list[str]) -> list[dict]:
        """
        Chunk a list of page texts, annotating each chunk with its page number.
        Returns list of dicts with 'text', 'page', 'chunk_index'.
        """
        result = []
        chunk_idx = 0

        for page_num, page_text in enumerate(pages, 1):
            chunks = self.chunk(page_text)
            for chunk in chunks:
                result.append(
                    {
                        "text": chunk,
                        "page": page_num,
                        "chunk_index": chunk_idx,
                    }
                )
                chunk_idx += 1

        return result
