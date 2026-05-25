<div align="center">

```
 ██████╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗
██╔════╝██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝
██║     ██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝ 
██║     ██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗ 
╚██████╗╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗
 ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
```

**Your private AI assistant — 100% local, zero cloud, zero compromise.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](#)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-ffc131?logo=tauri)](https://tauri.app)
[![Ollama](https://img.shields.io/badge/Ollama-compatible-white)](https://ollama.ai)

</div>

---

Cortex is a **privacy-first desktop AI assistant** that runs entirely on your machine. No API keys, no subscriptions, no data leaving your device — ever.

- Chat with any local LLM via [Ollama](https://ollama.ai)
- Ask questions about your own documents (RAG)
- Write and preview Markdown notes
- Get coding help with starter prompts
- Manage and download models from within the app

---

## Prerequisites

Install these before anything else:

| Tool | Version | Download |
|------|---------|---------|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org) |
| **pnpm** | 9+ | `npm install -g pnpm` |
| **Rust** | 1.77+ | [rustup.rs](https://rustup.rs) |
| **Ollama** | Latest | [ollama.com/download](https://ollama.com/download) |

> **Windows users:** After installing Rust, restart your terminal so `cargo` is on your PATH.

---

## Setup

### 1 — Clone the repo

```bash
git clone https://github.com/spsokhi/Cortex.git
cd Cortex
```

### 2 — Install dependencies

```bash
pnpm install
```

If prompted about native packages, approve them:

```bash
pnpm approve-builds
```

### 3 — Start Ollama

Ollama must be running in the background before you launch Cortex.

```bash
# macOS / Linux
ollama serve

# Windows — Ollama runs automatically after installation.
# If not, open the Ollama app from the Start Menu or run:
ollama serve
```

### 4 — Pull a model

```bash
# Recommended — fast and capable (~2.0 GB)
ollama pull llama3.2:3b

# Larger, higher quality (~4.7 GB)
ollama pull llama3:8b

# Smallest, great for low-RAM machines (~1.3 GB)
ollama pull phi3:mini
```

> You can also download models from inside the app under the **Models** tab.

### 5 — Run Cortex

```bash
pnpm tauri:dev
```

The app window will open. First build takes 2–5 minutes (Rust compiles). Subsequent starts are fast.

---

## What you can do

| Tab | What it does |
|-----|-------------|
| **Chat** | Talk to your local AI. Conversations are saved and searchable. |
| **Files** | Upload `.txt`, `.md`, or code files. Enable **RAG** in chat to ask questions about them. |
| **Code** | Coding-focused starter prompts that open pre-filled in Chat. |
| **Models** | Browse, download, and switch between any Ollama model. |
| **Notes** | Write Markdown notes. Auto-saved locally. Toggle Preview mode. |
| **Settings** | Adjust appearance, chat behaviour, and privacy options. |

### Using RAG (document Q&A)

1. Go to **Files** → upload a `.txt` or `.md` file → wait for "Indexed" status
2. Go to **Chat** → click the **database icon** in the input toolbar to enable RAG
3. Ask a question — Cortex will search your documents and include relevant context

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Ctrl+K` | Open command palette |
| `Ctrl+N` | New conversation |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Tauri 2](https://tauri.app) + Rust |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Animations | Framer Motion |
| State | Zustand (persisted to localStorage) |
| LLM runtime | [Ollama](https://ollama.ai) (local HTTP) |
| Build | Vite 5, pnpm |

---

## Project structure

```
Cortex/
├── src/                   # React frontend
│   ├── app/
│   │   ├── layout/        # AppLayout, Sidebar, TitleBar, StatusBar
│   │   └── routes/        # Chat, Files, Code, Models, Notes, Settings
│   ├── components/        # ChatMessage, ChatInput, ModelSelector, ...
│   ├── stores/            # Zustand stores (chat, files, models, notes, ui)
│   ├── hooks/             # useChat, useModels, useVoice, useSystem
│   └── types/             # TypeScript types
├── src-tauri/             # Rust backend (Tauri commands, Ollama client)
├── services/              # Python microservices (optional — voice, PDF RAG)
├── scripts/               # Setup and icon generation scripts
└── README.md
```

---

## Supported models

Any model in the [Ollama library](https://ollama.com/library) works. Recommended picks:

| Model | Size | Best for |
|-------|------|---------|
| `llama3.2:3b` | 2.0 GB | Default — fast and capable |
| `llama3:8b` | 4.7 GB | Higher quality responses |
| `mistral:7b` | 4.1 GB | Fast instruction following |
| `codellama:13b` | 7.4 GB | Code generation |
| `phi3:mini` | 1.3 GB | Low-RAM machines |
| `deepseek-coder-v2` | 8.9 GB | Advanced coding tasks |

---

## Production build

```bash
pnpm tauri:build
# Installers: src-tauri/target/release/bundle/
```

---

## Roadmap

- [x] Offline chat with streaming responses
- [x] Multi-conversation history with search
- [x] Document Q&A (RAG) — keyword-based retrieval
- [x] Model manager (download / switch models)
- [x] Markdown notes with preview
- [x] Code assistant with starter prompts
- [x] System resource monitor
- [ ] PDF text extraction
- [ ] Voice input (Whisper)
- [ ] Conversation export (Markdown / PDF)
- [ ] Semantic vector search (ChromaDB)
- [ ] Encrypted local storage

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

Built for privacy advocates, developers, and anyone who wants AI without the cloud.

**If you find this useful, give it a ⭐**

</div>
