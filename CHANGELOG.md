# Changelog

All notable changes to Cortex are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] — 2024-12-01

### Added
- Initial MVP release
- Offline AI chat via Ollama integration with streaming responses
- Multi-conversation management with history persistence (SQLite)
- Document Q&A with RAG pipeline (nomic-embed-text + ChromaDB)
- File drop zone supporting PDF, Markdown, TXT, code files
- Background file indexing with status tracking
- Voice input via faster-whisper (offline STT)
- Model manager with Ollama model browser and one-click pull
- Settings panel (models, RAG, voice, privacy, advanced)
- Markdown notes with live preview
- System resource monitor (CPU, RAM, VRAM, tokens/sec)
- Custom frameless window with Tauri 2
- Command palette (Ctrl+K)
- Cross-platform builds: Windows, macOS, Linux
- Docker Compose for Python microservices
- GitHub Actions CI/CD with release automation
- Zero telemetry by default
