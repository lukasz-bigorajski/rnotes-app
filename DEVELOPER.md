# Developer Guide

## Prerequisites

- **Rust** — install via [rustup](https://rustup.rs/)
- **Node.js** — v18+
- **pnpm** — `npm install -g pnpm`
- **Tauri system dependencies** — see [Tauri Prerequisites](https://tauri.app/start/prerequisites/) for your OS (WebView2 on Windows, webkit2gtk on Linux)

## Project Overview

Tauri 2.0 desktop app with:
- **Frontend:** React 19 + TypeScript + Mantine 7, served by Vite on port 1420
- **Backend:** Rust (SQLite via rusqlite, async via Tokio)
- **IPC bridge:** Tauri commands connect frontend to backend

## Running the Full App (Development)

```bash
pnpm install       # install frontend deps
pnpm tauri dev     # starts Vite dev server + Tauri window
```

`tauri dev` auto-runs `pnpm dev` (Vite on :1420), then launches the desktop window. Changes to frontend or Rust trigger hot-reload / recompile.

## Frontend Development

```bash
pnpm dev           # Vite dev server → http://localhost:1420
pnpm lint          # ESLint
pnpm format        # Prettier
```

Stack: React 19, Mantine 7, Vite 6, TypeScript 5.6

Key files:
- `src/` — React components and pages
- `vite.config.ts` — Vite configuration
- `src/ipc/notes.ts` — IPC client wrappers

### Building the Frontend

```bash
pnpm build         # tsc + vite build → dist/
```

## Building the Full Application

```bash
pnpm tauri build   # builds frontend + Rust release binary + installer
```

Output: `src-tauri/target/release/bundle/`

## Backend Development (Rust)

All Rust code lives in `src-tauri/`.

Key files:
- `src/lib.rs` — app setup and command registration
- `src/commands/` — Tauri command handlers
- `src/services/` — business logic
- `src/db/` — SQLite schema and queries

```bash
cd src-tauri
cargo build        # build only
cargo test         # run tests
cargo fmt          # format
cargo clippy       # lint
```

## IPC: Frontend ↔ Backend

Frontend calls backend via Tauri's `invoke`:

```ts
import { invoke } from "@tauri-apps/api/core";
const result = await invoke("command_name", { param: value });
```

TypeScript wrappers are in `src/ipc/notes.ts`.

Rust handlers in `src-tauri/src/commands/` are annotated with `#[tauri::command]` and registered in `lib.rs`.

## Debugging

**Frontend DevTools:** `Cmd+Option+I` (macOS) / `Ctrl+Shift+I` (Linux/Windows) in the Tauri window

**Backend logs:**
```bash
RUST_LOG=debug pnpm tauri dev
```
Rust logs appear in the terminal.

**IPC errors:** Check browser console for `invoke` errors; check terminal for Rust panics.

**Database:** SQLite file at:
- macOS: `~/Library/Application Support/com.rnotes.app/rnotes.db`
- Linux: `~/.local/share/com.rnotes.app/rnotes.db`
- Windows: `%APPDATA%\com.rnotes.app\rnotes.db`

## Project Structure

```
rnotes-app/
├── src/                        # React frontend
│   ├── ipc/notes.ts            # IPC client
│   └── ...
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs              # App setup
│   │   ├── commands/           # Tauri command handlers
│   │   ├── services/           # Business logic
│   │   └── db/                 # SQLite schema & queries
│   ├── Cargo.toml
│   └── tauri.conf.json         # Tauri config
├── vite.config.ts
└── package.json
```
