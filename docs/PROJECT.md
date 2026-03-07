# rnotes-app -- Project Overview

## Vision

rnotes-app is a desktop note-taking and knowledge management application built with Rust and Tauri. It provides rich text editing, hierarchical note organization, and task management in a fast, native-feeling desktop application. The architecture is designed for local-first operation with a clear path to encryption, cloud sync, and mobile support in the future.

---

## Architecture Overview

### Storage: Hybrid (SQLite + Filesystem)

All structured data (notes, metadata, tree hierarchy, task lists, full-text search index) is stored in a single SQLite database. Binary assets (images, attachments) are stored in a filesystem directory alongside the database. The database references assets by path.

```
rnotes-data/
  rnotes.db              -- SQLite database
  assets/
    {note-uuid}/
      image-001.png
      attachment.pdf
```

This approach keeps the database small (typically under 10MB for thousands of notes) while providing ACID transactions, built-in FTS5 full-text search, and indexed queries. Assets are stored separately to avoid database bloat and to allow individual file sync through cloud services.

### Application Architecture

```
+------------------------------------------------------------------+
|                        rnotes-app                                 |
|                                                                   |
|  +---------------------------+  +------------------------------+  |
|  |     React Frontend        |  |      Rust Backend (Tauri)    |  |
|  |                           |  |                              |  |
|  |  - TipTap Editor          |  |  - Note Service (CRUD)       |  |
|  |    (ProseMirror engine)   |  |  - Tree management           |  |
|  |  - Mantine UI components  |  |  - Search (FTS5)             |  |
|  |    (AppShell, Tree, etc.) |  |  - Task scheduling           |  |
|  |                           |  |  - Asset management (fs I/O) |  |
|  +---------------------------+  +------------------------------+  |
|                                                                   |
|           Tauri Commands (IPC bridge)                              |
+------------------------------------------------------------------+
                                    |
                                    v
                    +----------------------------------+
                    |         Data Directory           |
                    |  rnotes.db  +  assets/           |
                    +----------------------------------+
```

### Document Model

Notes are stored as TipTap/ProseMirror JSON -- a tree of typed nodes with marks and attributes. This is the native format of the TipTap editor, meaning storage is lossless: what is stored is exactly what renders. The JSON is kept in a TEXT column in SQLite.

### Key Design Decisions

- **UUIDv7 for all IDs** -- globally unique, sortable by creation time, safe for future sync scenarios.
- **Fractional indexing for sort order** -- REAL values allow drag-and-drop reordering without renumbering siblings.
- **Soft delete** -- notes are archived/marked with a `deleted_at` timestamp instead of hard-deleted, preventing sync issues and enabling recovery.
- **Debounced auto-save** -- saves after 1-2 seconds of inactivity to reduce database writes.
- **Asset immutability** -- images and attachments are never modified after creation; replacements create new assets.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Application framework | Tauri 2.0 | Rust backend + web frontend, desktop targets |
| Frontend framework | React | UI rendering |
| Frontend language | TypeScript | Type-safe frontend code |
| Rich text editor | TipTap v2 | Rich text editing with extensions for all required features |
| UI component library | Mantine v7+ | AppShell, Tree, 120+ components, proven Tauri compatibility |
| Backend language | Rust | Tauri requirement, performance, memory safety |
| Database | SQLite (via rusqlite) | ACID transactions, FTS5, JSON functions |
| Document format | TipTap/ProseMirror JSON | Lossless rich text representation |
| Asset storage | Filesystem | Binary files alongside the database |

---

## Feature List

### P0 -- MVP (Core Functionality)

These features define the minimum viable product.

- **Note CRUD** -- create, read, update, and delete notes
- **Rich text editing (basic)** -- bold, italic, strikethrough, text size adjustments
- **Paragraph formatting** -- headings (H1-H6)
- **Bullet lists and ordered lists**
- **Note tree structure** -- hierarchical folders and notes in a sidebar
- **Hyperlinks** -- insert and edit links within note content
- **Auto-save** -- debounced saving of note content to SQLite

### P1 -- Important Features

These features are expected by users of a note-taking app and should follow shortly after MVP.

- **Drag and drop** -- reorder and move notes/folders within the tree structure
- **Note archiving** -- soft-delete with ability to restore
- **Code blocks** -- code embedding with syntax highlighting
- **Quote blocks** -- blockquote formatting
- **Tables** -- insert and edit tables within notes
- **Embedded images** -- inline image insertion with positioning and movement
- **Full-text search** -- search across all notes using FTS5

### P2 -- Nice-to-Have

These features enhance the experience but are not blocking for release.

- **Collapsible sections** -- expanding and collapsing paragraphs/sections
- **Task lists** -- checkbox-based task items within notes
- **Task notifications** -- timed reminders for tasks with due dates
- **Note export** -- export notes to Markdown, HTML, or PDF

---

## Future Roadmap

The following capabilities are planned for future development. The architecture has been designed to support them without major refactoring, but they are out of scope for the initial release.

### Data Encryption at Rest

SQLCipher (drop-in encrypted SQLite) for the database, per-file AES-256-GCM encryption for assets. Designed to be additive -- switch a Cargo feature flag and add a password prompt. No schema or query changes required.

### Mobile Companion App

Tauri 2.0 supports iOS and Android builds from the same codebase. The same Rust backend, SQLite database format, and React/TipTap frontend can run in a mobile webview. Requires a mobile-optimized toolbar and platform-specific notification plugins.

### Cloud Sync (Dropbox / Google Drive)

The hybrid storage model is designed for file-based cloud sync. The small database file syncs as a unit; assets sync individually. Conflict detection via timestamps and checksums with a merge UI for conflicting edits. CRDT-based sync (via cr-sqlite) is a future upgrade path for automatic conflict resolution.

### Time Tracking

Track time spent on tasks or notes. Requires a separate `time_entries` table in SQLite and either an inline timer in the editor or a dedicated panel. Timer state persists across app restarts.

---

## References

- Research document: `docs/research/001-data-storage-architecture.md`
- Roadmap and task breakdown: `docs/ROADMAP.md`
