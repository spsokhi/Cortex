# Contributing to Cortex

Thank you for your interest in contributing! Cortex is an open-source project and we welcome contributions of all kinds.

## Development Setup

Follow the [setup instructions](README.md#installation) to get your environment ready.

## Project Conventions

### TypeScript / React
- Strict TypeScript — no `any` unless truly unavoidable
- Functional components only, no class components
- Co-locate component-specific types within the component file
- Use Zustand for global state, `useState` for local UI state
- All async operations should handle errors gracefully

### Rust
- Run `cargo fmt` and `cargo clippy` before committing
- Prefer `anyhow::Result` for error propagation
- Avoid `unwrap()` in production paths — use `?` or explicit handling
- All Tauri commands must be `async` and return `Result<T, String>`

### Python
- Python 3.11+ type hints required (`list[str]` not `List[str]`)
- `ruff` for linting (`ruff check services/`)
- Pydantic models for all API request/response types
- FastAPI — use `lifespan` for startup/shutdown, not `@app.on_event`

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add wake word detection
fix: correct SQLite WAL mode initialization
docs: update RAG setup instructions
perf: reduce embedding batch size for lower memory usage
refactor: split OllamaService into smaller methods
test: add chunk overlap edge case tests
```

## Pull Requests

1. Fork the repo and create your branch from `main`
2. Keep PRs focused — one feature or fix per PR
3. Add tests for new functionality where applicable
4. Update documentation if you change behavior
5. Ensure CI passes: `pnpm type-check && pnpm lint && cargo clippy`

## Reporting Issues

Use [GitHub Issues](https://github.com/cortexai/cortex/issues) with:
- OS and version
- Cortex version
- Steps to reproduce
- Expected vs actual behavior
- Logs (from `~/.cortex/logs/` or the Settings > Advanced > Logs)

## Areas Needing Help

- 🧪 **Tests** — unit and integration tests are thin
- 📖 **Documentation** — API docs, architecture docs, user guide
- 🌍 **Internationalization** — adding language support
- 🔌 **Plugin system** — designing the extension API
- 🎨 **Design** — UI/UX improvements and accessibility
- 🐛 **Bug fixes** — check open issues labeled `good first issue`

## Code of Conduct

Be kind, be constructive, and remember we're all here to build something useful together.
