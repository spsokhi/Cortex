import { describe, it, expect } from "vitest";
import { encodeEmbedding, decodeEmbedding, embedChunks, retrieveRag, EMPTY_RAG } from "./rag";
import { useFileStore } from "@/stores/fileStore";
import type { IndexedFile } from "@/types/files";

describe("embedding codec", () => {
  it("round-trips a vector as an approximately unit-length copy pointing the same way", () => {
    const vec = Array.from({ length: 768 }, (_, i) => Math.sin(i * 0.7) * (i % 5 === 0 ? 2 : 0.4));
    const decoded = decodeEmbedding(encodeEmbedding(vec));
    expect(decoded.length).toBe(768);

    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
    let decodedNorm = 0;
    let dot = 0;
    for (let i = 0; i < 768; i++) {
      decodedNorm += decoded[i] * decoded[i];
      dot += decoded[i] * (vec[i] / norm);
    }
    decodedNorm = Math.sqrt(decodedNorm);

    expect(decodedNorm).toBeCloseTo(1, 1);
    // int8 quantization must preserve direction almost exactly
    expect(dot / decodedNorm).toBeGreaterThan(0.999);
  });

  it("handles the zero vector without NaN", () => {
    const decoded = decodeEmbedding(encodeEmbedding(new Array<number>(16).fill(0)));
    for (const x of decoded) expect(Number.isNaN(x)).toBe(false);
  });
});

describe("retrieval scoping (keyword fallback, no Ollama)", () => {
  const base = { type: "md" as const, size: 1, indexStatus: "indexed" as const, tags: [], createdAt: 0, updatedAt: 0 };
  const fileA: IndexedFile = {
    ...base, id: "a", name: "rust.md", path: "rust.md",
    chunks: ["This project uses the borrow checker for memory safety."],
  };
  const fileB: IndexedFile = {
    ...base, id: "b", name: "baking.md", path: "baking.md",
    chunks: ["This project explains kneading dough and baking bread."],
  };

  it("searches every indexed file when no scope is given", async () => {
    useFileStore.setState({ files: [fileA, fileB] });
    const names = new Set((await retrieveRag("project")).citations.map((c) => c.fileName));
    expect(names.has("rust.md")).toBe(true);
    expect(names.has("baking.md")).toBe(true);
  });

  it("restricts retrieval to the attached file ids", async () => {
    useFileStore.setState({ files: [fileA, fileB] });
    const result = await retrieveRag("project", ["a"]);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations.every((c) => c.fileName === "rust.md")).toBe(true);
  });

  it("returns nothing when the scoped files aren't indexed yet", async () => {
    useFileStore.setState({ files: [fileA, fileB] });
    expect(await retrieveRag("project", ["not-indexed-yet"])).toEqual(EMPTY_RAG);
  });
});

const ollamaUp = await fetch("http://localhost:11434/api/tags")
  .then((r) => r.ok)
  .catch(() => false);

describe.runIf(ollamaUp)("semantic retrieval (live Ollama)", () => {
  it("ranks the semantically related chunk first and returns citations", async () => {
    const cooking =
      "Knead the dough for ten minutes, let it rise for an hour, then bake the loaf at 220C until golden.";
    const rust =
      "The borrow checker enforces ownership rules at compile time to guarantee memory safety.";
    const embeddings = await embedChunks([cooking, rust]);

    useFileStore.setState({
      files: [
        {
          id: "f1",
          name: "notes.md",
          path: "notes.md",
          type: "md",
          size: 1,
          indexStatus: "indexed",
          tags: [],
          createdAt: 0,
          updatedAt: 0,
          chunks: [cooking, rust],
          embeddings,
          embeddingModel: "nomic-embed-text",
        },
      ],
    });

    const result = await retrieveRag("how do I bake bread at home?");
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0].chunk).toBe(cooking);
    expect(result.citations[0].fileName).toBe("notes.md");
    expect(result.context).toContain("notes.md");
  }, 60000);

  it("returns nothing when no files are indexed", async () => {
    useFileStore.setState({ files: [] });
    expect(await retrieveRag("anything")).toEqual(EMPTY_RAG);
  });
});
