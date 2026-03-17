# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Style

- Enter plan mode for ANY non-trivial task
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building
- Use subagents liberally to keep main context window clean
- Make every change as simple as possible. Impact minimal code
- Find root causes. No temporary fixes
- Changes should only touch what's necessary
- Use context7 MCP for docs search
- For a big UI change write a playwright test
- After ANY correction from the user: update `prompts/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project
- Never mark a task complete without proving it works
- Ask yourself: "Would a staff engineer approve this?" Run tests, check logs, demonstrate correctness
- Verify change with running all tests (rust + playwright)

## What This Is

Tauri 2.0 desktop note-taking app. React 19 + TypeScript frontend, Rust + SQLite backend, connected via Tauri IPC commands.

## Commands

### Full App
```bash
pnpm install          # install frontend deps (run first)
pnpm tauri dev        # starts Vite + Tauri window (hot-reload)
pnpm tauri build      # production build → src-tauri/target/release/bundle/
```

### Frontend Only
```bash
pnpm dev              # Vite dev server on :1420
pnpm build            # tsc + vite build
pnpm lint             # ESLint
pnpm format           # Prettier
```

### Backend (run from src-tauri/)
```bash
cargo build
cargo test            # run all Rust tests
cargo test <name>     # run a single test by name
cargo fmt
cargo clippy
```

### E2E Tests
```bash
pnpm test:e2e         # Playwright headless
pnpm test:e2e:headed  # Playwright with browser UI
pnpm test:e2e:ui      # Playwright interactive UI
```

## Architecture

### Layers (backend, top-down)
```
commands/  →  Tauri #[command] handlers (lock DB mutex, delegate to services)
services/  →  Business logic, transactions, timestamps
db/        →  Raw SQL queries against rusqlite Connection
```

### Frontend → Backend IPC
- Frontend calls `invoke("command_name", { params })` via `@tauri-apps/api/core`
- TypeScript wrappers: `src/ipc/notes.ts` (types + invoke calls)
- Rust handlers: `src-tauri/src/commands/` (registered in `lib.rs`)

### Frontend Structure
- `App.tsx` — Mantine AppShell layout (sidebar + content area)
- `components/Sidebar.tsx` — Note list with create button
- `components/editor/NoteEditor.tsx` — TipTap rich text editor
- `hooks/useActiveNote.ts` — Load/save note by ID
- `hooks/useAutoSave.ts` — Debounced save (1s)

### Key Backend Files
- `src-tauri/src/lib.rs` — App setup, command registration
- `src-tauri/src/state.rs` — `DbState(Mutex<Connection>)`, `ConfigState`
- `src-tauri/src/error.rs` — `AppError` enum, `AppResult<T>` type alias
- `src-tauri/src/db/schema.rs` — SQLite schema & migrations
- `src-tauri/src/db/test_helpers.rs` — In-memory DB for tests

## Design Decisions

- **UUIDv7** for all IDs (sortable by creation time)
- **Soft delete** via `deleted_at` timestamp (no hard deletes)
- **TipTap/ProseMirror JSON** stored in `content` column (rich text)
- **FTS5** virtual table for full-text search (`notes_fts`)
- **SQLite WAL mode** with foreign keys and synchronous=NORMAL
- **Fractional sort_order** for drag-drop reordering without renumbering

## Code Style

### TypeScript
- Prettier: double quotes, semicolons, trailing commas, 100 char width
- ESLint 9 with TypeScript rules; unused vars prefixed with `_` are allowed

### Rust
- `rustfmt.toml` in `src-tauri/` controls formatting
- Use `AppError`/`AppResult` for error handling, not raw `Result<T, String>`

## Database Location
- macOS: `~/Library/Application Support/com.rnotes.app/rnotes.db`
- Linux: `~/.local/share/com.rnotes.app/rnotes.db`

## Debugging
- Frontend DevTools: `Cmd+Option+I` in Tauri window
- Backend logs: `RUST_LOG=debug pnpm tauri dev`
