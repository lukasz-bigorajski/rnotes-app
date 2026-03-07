# Data Storage Architecture Research: rnotes-app

**Date:** 2026-03-07
**Status:** Research Complete
**Application:** rnotes-app -- Rust + Tauri desktop note-taking and knowledge management app

---

## 1. Executive Summary

**Recommended Architecture:**

- **Storage:** Hybrid approach -- SQLite database for metadata, tree structure, and note content (as TipTap JSON) + filesystem directory for binary assets (images, attachments)
- **Document Model:** TipTap/ProseMirror JSON
- **Rich Text Editor:** TipTap (built on ProseMirror)
- **UI Component Library:** Mantine
- **Rust SQLite Library:** rusqlite (synchronous, full SQLite feature access, SQLCipher-compatible)
- **Encryption Path:** SQLCipher (drop-in encrypted SQLite fork) + per-file encryption for assets
- **Sync Strategy:** File-based cloud sync (Dropbox/Google Drive) of the SQLite database file + asset directory, with conflict detection via checksums and timestamps
- **Mobile Path:** Tauri 2.0 mobile targets (iOS/Android) sharing the same Rust backend and SQLite database format

**Rationale:** This architecture balances implementation simplicity with future extensibility. SQLite provides ACID transactions, full-text search, and a single-file database that syncs well through cloud storage services. The hybrid approach keeps binary assets out of the database to avoid bloat and sync inefficiency. TipTap's JSON document model maps cleanly to a TEXT column in SQLite and is the de facto standard for structured rich text storage. Mantine provides the most comprehensive component set (120+ components including Tree, AppShell) with proven Tauri compatibility and excellent bundle size characteristics.

---

## 2. Document Model Research

### 2.1 Format Options Compared

| Format | Structure | Rich Content Support | Parseability | Storage Efficiency | Editor Compatibility |
|--------|-----------|---------------------|--------------|-------------------|---------------------|
| **TipTap/ProseMirror JSON** | Tree of typed nodes with marks and attributes | Excellent -- native support for all required features | Machine-readable, structured | Moderate (verbose but compressible) | TipTap, ProseMirror (native) |
| **Markdown + Extensions** | Plain text with syntax | Limited -- no native tables, collapsible sections, inline images with positioning | Human-readable but ambiguous for rich content | Compact | Most editors (with conversion) |
| **Custom AST/JSON** | Application-defined tree | Unlimited (you define it) | Machine-readable | Depends on design | Requires custom rendering layer |
| **HTML** | DOM tree | Good but messy | Parseable but XSS-prone | Verbose | Any editor (lossy round-trips) |

### 2.2 TipTap/ProseMirror JSON (Recommended)

The TipTap JSON format represents documents as a tree of typed nodes. Each node has a `type`, optional `attrs`, optional `marks` (for inline formatting), and optional `content` (child nodes). Example:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [
        { "type": "text", "text": "My Note Title" }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Some " },
        {
          "type": "text",
          "marks": [{ "type": "bold" }],
          "text": "bold"
        },
        { "type": "text", "text": " text." }
      ]
    },
    {
      "type": "taskList",
      "content": [
        {
          "type": "taskItem",
          "attrs": { "checked": false },
          "content": [
            { "type": "paragraph", "content": [{ "type": "text", "text": "Buy groceries" }] }
          ]
        }
      ]
    }
  ]
}
```

**Feature mapping for rnotes-app requirements:**

| Requirement | TipTap Node/Extension | Support Level |
|-------------|----------------------|---------------|
| Bold, italic, strikethrough | Built-in marks | Native |
| Text size, headings | Heading node, FontSize extension | Native |
| Code blocks | CodeBlock / CodeBlockLowlight extension | Native (with syntax highlighting) |
| Quote embedding | Blockquote node | Native |
| Collapsible sections | Details extension (summary + content) | Native (extension) |
| Inline images | Image node (inline: true) | Native |
| Hyperlinks | Link mark | Native |
| Tables | Table, TableRow, TableCell, TableHeader | Native (extension package) |
| Bullet/ordered lists | BulletList, OrderedList | Native |
| Task lists | TaskList, TaskItem | Native |

**Why TipTap JSON over Markdown:**

Markdown cannot natively represent collapsible sections, inline image positioning, table cell formatting, or task list states without non-standard extensions. Converting between Markdown and a rich editor inevitably loses fidelity. TipTap JSON is a lossless representation of the editor state -- what you store is exactly what renders.

**Why TipTap JSON over custom JSON:**

Building a custom AST means building a custom serialization/deserialization layer, a custom rendering engine, and maintaining compatibility across versions. TipTap JSON is already a well-defined, versioned format with a large ecosystem. There is no advantage to reinventing it.

### 2.3 Storage of the Document Model

The TipTap JSON document is stored as a TEXT (JSON) column in SQLite. This enables:

- **Full-text search:** Extract plain text from the JSON tree and store in an FTS5 virtual table
- **Structured queries:** Use SQLite JSON functions (`json_extract`) to query document attributes
- **Versioning:** Store previous versions as additional rows with timestamps
- **Compression:** JSON compresses well (typically 3-5x with zlib/lz4) if storage becomes a concern

---

## 3. Storage Approach Comparison

### 3.1 Comparison Matrix

| Criterion | Individual Files | SQLite (Single DB) | Hybrid (SQLite + Files) | Other Embedded DBs |
|-----------|-----------------|--------------------|-----------------------|-------------------|
| **Implementation complexity** | Low | Low-Medium | Medium | Medium-High |
| **Rich text storage** | One file per note (JSON/MD) | JSON in TEXT column | JSON in TEXT column | Key-value or document |
| **Image/asset storage** | Files alongside notes | BLOBs in DB | Files in asset directory | BLOBs or external |
| **Tree/hierarchy** | Directory structure or manifest file | Parent-child table | Parent-child table | Depends on DB |
| **Full-text search** | External index needed | FTS5 built-in | FTS5 built-in | Varies |
| **ACID transactions** | No (filesystem is not transactional) | Yes | Partial (DB is ACID, files are not) | Yes (most) |
| **Encryption path** | Per-file encryption | SQLCipher (transparent) | SQLCipher + per-file encryption | DB-specific |
| **Cloud sync (Dropbox/GDrive)** | Good (granular file changes) | Problematic (entire DB file changes on any edit) | Moderate (DB is small, assets sync individually) | Problematic (opaque binary formats) |
| **Conflict resolution** | Per-note conflicts (manageable) | Entire-DB conflicts (destructive) | DB conflicts possible but less likely | Entire-DB conflicts |
| **Mobile compatibility** | Good (standard file I/O) | Excellent (SQLite is universal) | Good (both available on mobile) | Varies (Rust FFI needed) |
| **Performance at scale (1000+ notes)** | Degrades (filesystem overhead, no indexing) | Excellent (indexed queries, single file handle) | Excellent | Excellent |
| **Rust ecosystem maturity** | std::fs (mature) | rusqlite/sqlx (very mature) | Both mature | Varies (see below) |

### 3.2 Approach 1: Individual Files Per Note

**How it works:** Each note is a file (e.g., `notes/uuid.json`) containing the TipTap JSON document. A manifest file or directory structure represents the tree hierarchy. Images are stored alongside notes in an assets directory.

**Real-world example:** Obsidian uses individual Markdown files with a vault directory structure. Zettlr follows a similar model.

**Pros:**
- Human-readable and debuggable
- Granular cloud sync (only changed files sync)
- No database dependency
- Easy backup (just copy the directory)
- Conflict resolution is per-note (cloud services create "conflicted copy" files)

**Cons:**
- No transactional guarantees (partial writes, corruption risk during saves)
- Full-text search requires building and maintaining a separate index
- Tree/hierarchy management is fragile (renaming/moving files can break references)
- Performance degrades with thousands of files (directory listing, file handle overhead)
- Metadata queries (e.g., "all notes modified this week") require scanning all files
- Atomic operations across multiple notes (move, reorder) are not possible

**Encryption:** Each file must be individually encrypted/decrypted. Key management is application-level. Opening any note requires a decrypt operation.

**Sync:** Cloud services handle individual files well. Conflicts produce "conflicted copy" files that the app must detect and offer merge UI. This is the same approach Obsidian uses with Dropbox/iCloud.

### 3.3 Approach 2: SQLite (Single Database File)

**How it works:** A single SQLite database file contains all notes, metadata, tree structure, and potentially binary assets as BLOBs.

**Real-world example:** Bear uses SQLite for all note content with images in a separate folder. Notion uses SQLite as a local cache layer.

**Proposed schema:**

```sql
CREATE TABLE notes (
    id TEXT PRIMARY KEY,          -- UUID
    title TEXT NOT NULL,
    content TEXT NOT NULL,         -- TipTap JSON
    parent_id TEXT,               -- FK to notes.id (for tree structure)
    sort_order REAL,              -- Fractional indexing for drag-drop reorder
    is_archived INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES notes(id)
);

CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    data BLOB NOT NULL,           -- or store path if hybrid
    created_at TEXT NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes(id)
);

CREATE TABLE note_tasks (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    task_text TEXT,
    is_completed INTEGER DEFAULT 0,
    due_at TEXT,                   -- for timed notifications
    notify_at TEXT,
    FOREIGN KEY (note_id) REFERENCES notes(id)
);

CREATE VIRTUAL TABLE notes_fts USING fts5(title, content_text, content=notes);
```

**Pros:**
- ACID transactions (no partial writes, no corruption)
- Built-in FTS5 for full-text search
- Indexed queries for metadata (fast "recent notes", "search by tag", etc.)
- Single file to manage, backup, and encrypt
- Excellent performance with 10,000+ notes
- Mature Rust ecosystem (rusqlite, sqlx)
- SQLCipher provides transparent encryption with 5-15% overhead
- Universal mobile support (SQLite runs everywhere)

**Cons:**
- Cloud sync of the entire database file on every change (even a single-character edit syncs the whole file)
- Conflict resolution for the database file is all-or-nothing (cloud services cannot merge SQLite files)
- Storing large BLOBs (images) bloats the database and makes sync worse
- Not human-readable without tooling

**Encryption:** SQLCipher is a drop-in replacement for SQLite that provides transparent AES-256 encryption. In Rust, use `rusqlite` with the `bundled-sqlcipher` feature flag in `libsqlite3-sys`. The entire database is encrypted; decryption happens in memory with minimal overhead.

**Sync:** The single-file nature is both a strength and weakness. For small databases (<50MB), cloud services like Dropbox handle it well -- the file syncs as a unit. For larger databases, every edit causes the entire file to re-upload. Conflicts are destructive: if two devices edit simultaneously, one version wins.

### 3.4 Approach 3: Hybrid (SQLite + Filesystem) -- RECOMMENDED

**How it works:** SQLite stores all structured data (notes, metadata, tree structure, task lists, FTS index). Binary assets (images, attachments) are stored in a filesystem directory alongside the database. The database references assets by filename/path.

**Directory structure:**

```
rnotes-data/
  rnotes.db              -- SQLite database (notes, metadata, tree, FTS)
  assets/
    {note-uuid}/
      image-001.png
      image-002.jpg
      attachment.pdf
```

**Real-world example:** Bear uses exactly this pattern -- SQLite for notes, a folder for images and attachments. This is also how many iOS/macOS apps with Core Data + file attachments work.

**Pros:**
- All the SQLite benefits (ACID, FTS5, indexed queries, performance)
- Database file stays small (typically <10MB for thousands of notes)
- Assets sync individually through cloud services (only changed/added images sync)
- Database conflicts are less frequent (small file, fast sync)
- Assets never conflict (they are write-once, immutable by convention)
- Clean separation of concerns
- Encryption can be layered: SQLCipher for the database, per-file encryption for assets

**Cons:**
- Two things to manage instead of one (database + asset directory)
- Must ensure referential integrity between DB and filesystem (orphaned assets, missing references)
- Slightly more complex backup/restore (must include both DB and assets directory)
- Asset deletion requires both DB update and file deletion

**Encryption:** SQLCipher encrypts the database transparently. Assets can be encrypted individually using AES-256-GCM with a key derived from the user's master password. Since assets are write-once (images don't change after insertion), encryption happens once at write time.

**Sync:** The database file is small and syncs quickly. Assets sync individually -- only new or deleted assets cause sync activity. Conflict risk is low because:
1. The database is small and syncs fast (reducing the window for conflicts)
2. Assets are immutable (no edit conflicts possible)
3. The worst case is a database conflict, which can be resolved by comparing timestamps or offering the user a choice

### 3.5 Approach 4: Other Embedded Databases

| Database | Type | Rust Support | Maturity | Full-Text Search | Sync Friendliness |
|----------|------|-------------|----------|-----------------|-------------------|
| **sled** | Key-value (LSM-inspired) | Native Rust | Beta (unstable, not recommended for production) | No built-in | Poor (opaque binary format) |
| **redb** | Key-value (B-tree, pure Rust) | Native Rust | 1.0 stable | No built-in | Poor (opaque binary format) |
| **RocksDB** | Key-value (LSM-tree) | Rust bindings (C++ FFI) | Very mature | No built-in | Poor (opaque multi-file format) |
| **SurrealDB Embedded** | Multi-model document DB | Native Rust | Pre-1.0, evolving rapidly | Built-in | Poor (opaque format) |
| **DuckDB** | Analytical column-store | Rust bindings | Stable but analytical focus | Limited | Poor (single file but analytical) |

**Assessment:** None of these databases provide a compelling advantage over SQLite for a note-taking application:

- **sled:** Explicitly warns it is beta and should not be used for production data. The author has stated it needs a rewrite. Not recommended.
- **redb:** Stable and pure Rust, but provides only key-value storage. No SQL, no FTS, no relational queries. You would need to build your own query layer, indexing, and search. The added complexity is not justified.
- **RocksDB:** Extremely mature and performant, but designed for high-throughput server workloads. Overkill for a desktop note-taking app. Requires C++ toolchain for builds. No SQL, no FTS.
- **SurrealDB Embedded:** Interesting multi-model capabilities (documents, graphs, relations) but pre-1.0, rapidly changing API, and significantly more complex than SQLite. The features it adds (graph queries, real-time subscriptions) are not needed for rnotes-app.
- **DuckDB:** Optimized for analytical queries (OLAP), not transactional workloads (OLTP). Wrong tool for the job.

**Verdict:** SQLite remains the best embedded database for this use case. It has decades of battle-testing, universal platform support, built-in FTS5, JSON functions, the SQLCipher encryption extension, and the most mature Rust ecosystem. No alternative provides enough additional value to justify the added complexity and reduced ecosystem support.

---

## 4. Rich Text Editor Research

### 4.1 Editor Comparison

| Criterion | TipTap | Lexical | Slate | ProseMirror (raw) |
|-----------|--------|---------|-------|-------------------|
| **Underlying engine** | ProseMirror | Custom (Meta) | Custom | ProseMirror |
| **React support** | Official bindings | Official React package | React-first (tightly coupled) | Community wrappers |
| **Release maturity** | Stable (v2+) | Pre-1.0 (no stable release) | Beta (no 1.0 schedule) | Stable |
| **Documentation quality** | Excellent, with examples | Growing, improving | Adequate but sparse | Excellent but low-level |
| **Extension ecosystem** | 100+ extensions | Growing plugin set | Build-everything-yourself | Build-everything-yourself |
| **Collapsible sections** | Details extension (built-in) | Custom node required | Custom implementation | Custom node spec required |
| **Inline images** | Image extension (inline: true) | Custom node required | Custom implementation | Custom node spec required |
| **Tables** | Table extension package | Custom plugin required | Custom implementation | prosemirror-tables package |
| **Task lists** | TaskList extension | Custom node required | Custom implementation | Custom extension required |
| **Code blocks** | CodeBlock + CodeBlockLowlight | Custom node | Custom implementation | Custom node spec |
| **Document model storage** | JSON (getJSON/setContent) | Custom serialization | Custom serialization | JSON (toJSON/fromJSON) |
| **Mobile browser support** | Good | Good | Poor (known iOS/Android issues) | Good |
| **TypeScript** | Full TypeScript | Full TypeScript | Full TypeScript | Types available |
| **Learning curve** | Moderate | Steep | Steep | Very steep |
| **Community size** | Large (30k+ GitHub stars) | Large (20k+ stars, Meta backing) | Medium (30k+ stars but less active) | Medium (mature but niche) |

### 4.2 TipTap (Recommended)

**Why TipTap is the best fit for rnotes-app:**

1. **Every required feature has a built-in extension.** Collapsible sections (Details), inline images (Image with inline:true), tables (Table package), task lists (TaskList), code blocks with syntax highlighting (CodeBlockLowlight), blockquotes, links -- all available as first-party or well-maintained extensions. No custom node implementations needed for the core feature set.

2. **JSON document model maps directly to storage.** `editor.getJSON()` produces a serializable JSON tree that can be stored as-is in a SQLite TEXT column. `editor.commands.setContent(json)` restores it. No custom serialization layer needed.

3. **Best documentation and developer experience.** TipTap's documentation includes working examples for every extension, clear API references, and guides for custom extensions. This reduces development time significantly compared to Lexical or Slate where most features must be built from scratch.

4. **Extension architecture supports future needs.** Custom extensions can be added for time tracking, notification triggers, or any other rnotes-specific feature without modifying the core editor.

5. **Stable API.** TipTap v2 has been stable since 2022. Breaking changes are rare and well-documented. Lexical has not reached 1.0, and Slate explicitly warns about breaking changes.

**Why not Lexical:**
Lexical is backed by Meta and has strong React integration, but it has not reached a 1.0 release. Its extension ecosystem is narrower than TipTap's -- implementing tables, collapsible sections, and inline images all require custom node implementations. The document model uses a custom serialization format rather than a standard JSON tree, adding complexity to the storage layer. Lexical is a better choice for applications that need deep customization beyond what TipTap's extension system allows, but rnotes-app's feature set aligns well with TipTap's built-in extensions.

**Why not Slate:**
Slate is a low-level framework that provides maximum flexibility but requires building everything from scratch -- formatting, tables, images, lists, and task lists all need custom implementations. It is still in beta with no 1.0 release schedule. Mobile browser support has known issues on iOS Safari and Chrome for Android. The steep learning curve and implementation burden make it a poor choice when TipTap provides the same features out of the box.

**Why not raw ProseMirror:**
TipTap IS ProseMirror with a better API. Using ProseMirror directly provides no additional capability but requires significantly more boilerplate code. TipTap wraps ProseMirror's low-level APIs with a clean extension system and React integration. There is no reason to use ProseMirror directly unless TipTap's abstraction layer creates problems (unlikely for this use case).

### 4.3 TipTap Integration Notes

- **Package:** `@tiptap/react` for React integration
- **Key extensions needed:** `@tiptap/starter-kit` (basics), `@tiptap/extension-table`, `@tiptap/extension-image`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-code-block-lowlight`, `@tiptap/extension-link`, `@tiptap/extension-details`, `@tiptap/extension-details-summary`, `@tiptap/extension-details-content`
- **Custom extensions needed for rnotes:** Timed task notifications (extend TaskItem with due date attributes), time tracking blocks
- **Storage integration:** Call `editor.getJSON()` on save, pass JSON string to Rust backend via Tauri command, store in SQLite

---

## 5. React Component Library Recommendation

### 5.1 Comparison Matrix

| Criterion | Mantine | shadcn/ui | MUI | Ant Design | Chakra UI |
|-----------|---------|-----------|-----|------------|-----------|
| **Component count** | 120+ components, 70+ hooks | ~50 components | 60+ components | 60+ enterprise components | 60+ components |
| **Tree view component** | Built-in Tree component | Community implementations only | TreeView (MUI X, paid for advanced) | Tree component | No built-in |
| **App shell / sidebar** | AppShell component (built-in) | Sidebar component | Drawer + AppBar | Layout + Sider | Drawer |
| **Tauri compatibility** | Proven (templates exist, real apps built) | Good (no known issues) | Good | Good | Good |
| **Bundle size (base)** | 124KB | 156KB | ~300KB+ | ~300KB+ | ~200KB+ |
| **Bundle size (25 components)** | 298KB | 412KB | Larger | Larger | Larger |
| **Tree-shaking** | Excellent | Good | Moderate | Moderate | Good |
| **Styling approach** | CSS modules (v7+, removed emotion) | Tailwind CSS + Radix | emotion (CSS-in-JS) | CSS modules + antd styles | emotion (CSS-in-JS) |
| **Customization** | Theme object + CSS variables | Full source code ownership | Theme provider | ConfigProvider | Theme object |
| **TypeScript** | Excellent | Excellent | Excellent | Good | Good |
| **Active maintenance** | Very active (v8 in development) | Very active | Very active | Active | Slowing down |
| **Desktop-app feel** | Good (compact modes, keyboard nav) | Good (minimal aesthetic) | Material Design (mobile-first feel) | Enterprise feel (data-heavy UIs) | Web-first |

### 5.2 Mantine (Recommended)

**Why Mantine is the best fit for rnotes-app:**

1. **Built-in Tree component.** Mantine provides a Tree component with customizable node rendering, expansion state management, and selection support. This maps directly to the note/folder tree structure in rnotes-app. shadcn/ui requires community-built tree components; MUI's advanced TreeView is in the paid MUI X package.

2. **AppShell component.** Mantine's AppShell provides a pre-built layout with header, sidebar (navbar), and content area -- exactly the layout pattern for a note-taking app. It supports collapsible sidebar, responsive breakpoints, and nested navigation.

3. **Best bundle size characteristics.** At 124KB base and excellent tree-shaking, Mantine is the lightest option that still provides comprehensive components. For a desktop app where every KB matters less than on web, this is still a good practice -- faster startup, lower memory.

4. **Proven Tauri compatibility.** Multiple open-source projects use Tauri + React + Mantine, and dedicated templates exist (tauri-react-mantine-vite-template). No known compatibility issues.

5. **Rich hook library.** Mantine's 70+ hooks include `useForm`, `useHotkeys`, `useLocalStorage`, `useColorScheme`, `useDebouncedValue`, and others that are directly useful for a note-taking app. These reduce boilerplate significantly.

6. **CSS modules (v7+).** Mantine removed the emotion CSS-in-JS dependency in v7, switching to CSS modules and CSS variables. This improves performance, reduces bundle size, and eliminates the SSR hydration issues that plague emotion-based libraries (though SSR is not relevant for Tauri, the performance benefit remains).

7. **Comprehensive form handling.** `@mantine/form` provides validation, nested fields, and array fields -- useful for note metadata editing, settings panels, and task management UI.

**Why not shadcn/ui:**
shadcn/ui has gained enormous popularity and produces clean, minimal UIs. However, its "copy source code into your project" model means you own and maintain all component code. For a solo developer or small team building a desktop app, this is a maintenance burden. shadcn/ui also lacks a built-in Tree component (critical for rnotes-app's folder tree) and a pre-built AppShell layout. The Tailwind CSS dependency adds configuration overhead but is not a dealbreaker. shadcn/ui is a strong second choice.

**Why not MUI:**
MUI's Material Design aesthetic gives applications a mobile/Android feel that may not be desirable for a desktop note-taking app. The bundle size is significantly larger. The advanced TreeView component is part of MUI X (paid for commercial use). MUI is excellent for enterprise web applications but is heavier than needed for rnotes-app.

**Why not Ant Design:**
Ant Design excels at enterprise data-heavy UIs (admin panels, dashboards) but its aesthetic is not well-suited for a personal note-taking app. The bundle size is large, and the documentation has historically been Chinese-first (though English docs have improved). It includes a Tree component, but Mantine's offering is simpler and more customizable.

---

## 6. Sync and Conflict Resolution Strategy

### 6.1 Architecture for Cloud Sync

The hybrid storage approach (SQLite + asset files) syncs through file-based cloud services as follows:

```
rnotes-data/           <-- This entire directory lives inside Dropbox/Google Drive
  rnotes.db            <-- SQLite database (~1-10MB typically)
  rnotes.db-wal        <-- WAL file (must also sync)
  rnotes.db-shm        <-- Shared memory file (should be excluded from sync)
  assets/
    {note-uuid}/
      image-001.png
      ...
```

**Important:** SQLite should be configured in WAL (Write-Ahead Logging) mode for better concurrent read/write behavior. However, the WAL file must be checkpointed (merged back into the main database file) before sync to avoid corruption. The application should:

1. Checkpoint the WAL before closing: `PRAGMA wal_checkpoint(TRUNCATE)`
2. Exclude `.db-shm` from sync (it is ephemeral and recreated on open)
3. Sync `.db` and `.db-wal` together

### 6.2 Conflict Scenarios and Resolution

| Scenario | Likelihood | Detection | Resolution |
|----------|-----------|-----------|------------|
| **Two devices edit different notes** | Common | Database file modified on both sides | Cloud service creates conflicted copy; app detects and merges (see below) |
| **Two devices edit the same note** | Uncommon (single user) | Conflicted copy of database | App detects, shows diff, user chooses |
| **New asset added on both devices** | Rare | No conflict (different UUIDs) | Assets merge naturally (different filenames) |
| **Note deleted on one, edited on other** | Rare | Conflicted copy | App detects, user chooses |

### 6.3 Conflict Detection and Merge Strategy

When the application opens, it should:

1. **Scan for conflicted copies.** Dropbox creates files like `rnotes (conflicted copy 2026-03-07).db`. Google Drive creates duplicate files. The app should scan for these patterns.

2. **If a conflicted copy is found:**
   a. Open both databases (main and conflicted copy)
   b. Compare each note by UUID and `updated_at` timestamp
   c. For notes modified only in one copy: take the modified version
   d. For notes modified in both copies: present a merge UI showing both versions
   e. For notes deleted in one copy but modified in the other: ask the user
   f. After merging, delete the conflicted copy

3. **Merge algorithm (per note):**
   - Compare `updated_at` timestamps
   - If only one side changed: take that version (last-write-wins)
   - If both sides changed: keep both versions as "conflicted" and show the user a side-by-side diff of the TipTap JSON (rendered as rich text)

### 6.4 Future Enhancement: CRDT-Based Sync

For a more sophisticated sync solution in the future, consider:

- **cr-sqlite:** A SQLite extension that adds CRDT-based multi-writer replication. Changes can be merged automatically without conflicts at the column level. Available as a loadable extension compatible with rusqlite.
- **SQLite Sync (sqlite.ai):** A commercial SQLite extension using CRDTs for seamless conflict-free sync across devices.

These solutions would eliminate the need for manual conflict resolution but add complexity. They are not needed for the initial release but represent a clear upgrade path.

### 6.5 Practical Sync Recommendations

1. **Add a `sync_version` column** to the notes table -- an integer that increments on every edit. This enables quick change detection.
2. **Add a `device_id` column** to track which device last modified a note.
3. **Use UUIDs (v7 recommended)** for all primary keys -- never auto-incrementing integers. UUIDs are globally unique and prevent ID collisions between devices.
4. **Use fractional indexing** (e.g., `sort_order REAL`) for tree ordering instead of integer positions. This allows insertions without renumbering.
5. **Soft-delete notes** (set `is_archived = 1` or `deleted_at = timestamp`) instead of hard deleting. This prevents "ghost" references on other devices.

---

## 7. Encryption Path

### 7.1 Architecture for Encryption at Rest

The encryption strategy has two layers, matching the hybrid storage approach:

**Layer 1: Database encryption (SQLCipher)**

SQLCipher is a fork of SQLite that provides transparent AES-256 encryption of the entire database file. Every byte on disk is encrypted; decryption happens in memory.

- **Rust integration:** Use `rusqlite` with `libsqlite3-sys` compiled with the `bundled-sqlcipher` feature flag
- **Performance overhead:** 5-15% on most operations (negligible for a note-taking app)
- **Key derivation:** User provides a master password; derive the encryption key using Argon2id (or PBKDF2 as SQLCipher default)
- **Migration path:** An existing unencrypted database can be converted to encrypted using `sqlcipher_export`

```rust
// Cargo.toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled-sqlcipher"] }
```

```rust
// Opening an encrypted database
let conn = Connection::open("rnotes.db")?;
conn.pragma_update(None, "key", &user_password)?;
```

**Layer 2: Asset file encryption**

Binary assets are encrypted individually using AES-256-GCM:

- Each asset file is encrypted with a unique nonce
- The encryption key is derived from the same master password
- File extension is changed to `.enc` to indicate encrypted status
- Decryption happens on-demand when the asset is displayed in the editor

**Key management:**

- The master password is never stored; the user enters it on app launch
- A key verification token is stored in the database (encrypted with the derived key) to validate the password
- Consider OS keychain integration (macOS Keychain, Windows Credential Manager) for optional "remember password" functionality

### 7.2 Implementation Without Refactoring

The encryption layer is designed to be additive:

1. **Database:** Switch from `rusqlite` with standard SQLite to `rusqlite` with `bundled-sqlcipher`. The API is identical. Add a `PRAGMA key` call on connection open. No schema changes, no query changes.

2. **Assets:** Add an encrypt/decrypt wrapper around the asset read/write functions. The rest of the application sees the same `read_asset(id) -> bytes` and `write_asset(id, bytes)` interface.

3. **Configuration:** Add a `is_encrypted` flag to the app settings. On first enable, run a migration that encrypts the database and all existing assets.

This design means encryption can be added as a feature toggle without touching the storage layer, the editor, or the UI (beyond adding a password prompt and encryption settings).

---

## 8. Mobile Compatibility

### 8.1 Tauri 2.0 Mobile Support

Tauri 2.0 (stable since October 2024) provides first-class support for iOS and Android builds from the same codebase:

- **Shared Rust backend:** The same Rust code that manages SQLite, encryption, and file I/O runs on mobile
- **Shared frontend:** The same React + TipTap + Mantine UI renders in a mobile webview
- **Platform-specific features:** Swift (iOS) and Kotlin (Android) plugins for native functionality (notifications, file pickers, sharing)
- **Build tooling:** `tauri ios dev` and `tauri android dev` with hot-reloading

### 8.2 Data Format Compatibility

The hybrid storage architecture is fully compatible with mobile:

- **SQLite:** Available on every mobile platform. rusqlite compiles for iOS and Android through Tauri's Rust cross-compilation. SQLCipher also works on mobile.
- **Filesystem:** Both iOS and Android provide app-sandboxed storage for the asset directory.
- **TipTap JSON:** The same TipTap editor runs in the mobile webview, reading and writing the same JSON format.

### 8.3 Sync Between Desktop and Mobile

Two sync strategies for the mobile companion app:

**Strategy A: Shared cloud folder (simplest)**
- The rnotes data directory lives in iCloud Drive, Google Drive, or Dropbox
- Both desktop and mobile apps read/write the same directory
- Same conflict resolution strategy applies
- Limitation: requires the cloud service's mobile app to sync files to the device

**Strategy B: Direct sync (more control)**
- Implement a sync protocol using cr-sqlite or a custom solution
- Desktop and mobile exchange changesets (not full database files)
- Requires a relay server or peer-to-peer connection
- More complex but more robust

**Recommendation:** Start with Strategy A (shared cloud folder). It requires zero sync infrastructure and works with existing cloud services. Upgrade to Strategy B if/when the limitations of file-based sync become problematic (e.g., large databases, frequent conflicts, need for real-time sync).

### 8.4 Mobile-Specific Considerations

- **TipTap on mobile webviews:** TipTap/ProseMirror has good mobile browser support. Touch-based editing works but may need a mobile-optimized toolbar.
- **Mantine responsive:** Mantine components are responsive and work in mobile viewports. The AppShell can collapse the sidebar for mobile.
- **Performance:** SQLite is fast on mobile. The main concern is initial load time of the React/TipTap bundle in the webview. Code splitting and lazy loading will help.
- **Notifications:** Task notification scheduling requires platform-specific Tauri plugins (iOS: UNUserNotificationCenter, Android: AlarmManager).

---

## 9. Recommended Architecture

### 9.1 Architecture Diagram

```
+------------------------------------------------------------------+
|                        rnotes-app                                 |
|                                                                   |
|  +---------------------------+  +------------------------------+  |
|  |     React Frontend        |  |      Rust Backend (Tauri)    |  |
|  |                           |  |                              |  |
|  |  +---------------------+  |  |  +------------------------+  |  |
|  |  |   TipTap Editor     |  |  |  |   Note Service         |  |  |
|  |  |   (ProseMirror)     |<-+--+->|   - CRUD operations    |  |  |
|  |  |                     |  |  |  |   - Tree management    |  |  |
|  |  |   getJSON() /       |  |  |  |   - Search (FTS5)      |  |  |
|  |  |   setContent()      |  |  |  |   - Task scheduling    |  |  |
|  |  +---------------------+  |  |  +----------+-------------+  |  |
|  |                           |  |             |                 |  |
|  |  +---------------------+  |  |  +----------v-------------+  |  |
|  |  |   Mantine UI        |  |  |  |   Storage Layer        |  |  |
|  |  |                     |  |  |  |                        |  |  |
|  |  |   - AppShell        |  |  |  |   +------------------+ |  |  |
|  |  |   - Tree (sidebar)  |  |  |  |   | rusqlite         | |  |  |
|  |  |   - Toolbar         |  |  |  |   | (+ SQLCipher)    | |  |  |
|  |  |   - Dialogs         |  |  |  |   +--------+---------+ |  |  |
|  |  |   - Forms           |  |  |  |            |           |  |  |
|  |  +---------------------+  |  |  |   +--------v---------+ |  |  |
|  +---------------------------+  |  |   | Asset Manager    | |  |  |
|                                 |  |   | (filesystem I/O) | |  |  |
|  Tauri Commands (IPC)           |  |   +------------------+ |  |  |
|  <---------------------------->  |  +------------------------+  |  |
+------------------------------------------------------------------+
                                      |
                                      v
                    +----------------------------------+
                    |         Data Directory           |
                    |  (inside Dropbox/GDrive/iCloud)  |
                    |                                  |
                    |  rnotes.db  (SQLite/SQLCipher)   |
                    |  assets/                         |
                    |    {uuid}/image-001.png          |
                    |    {uuid}/image-002.jpg          |
                    +----------------------------------+
```

### 9.2 Technology Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Tauri 2.0 | Rust backend, web frontend, desktop + mobile support |
| **Frontend framework** | React | Already decided |
| **Frontend language** | Typescript | Already decided |
| **Rich text editor** | TipTap v2 | Best extension coverage, stable API, JSON document model |
| **UI components** | Mantine v7+ | Built-in Tree, AppShell, 120+ components, best bundle size, Tauri-proven |
| **Backend language** | Rust | Tauri requirement, performance, safety |
| **Database** | SQLite (via rusqlite) | ACID, FTS5, JSON functions, universal platform support |
| **Database encryption** | SQLCipher (via bundled-sqlcipher feature) | Transparent AES-256, drop-in SQLite replacement |
| **Asset storage** | Filesystem (app data directory) | Keeps DB small, assets sync individually |
| **Document format** | TipTap/ProseMirror JSON | Lossless rich text representation, native editor format |
| **IDs** | UUIDv7 | Globally unique, sortable by creation time, sync-safe |
| **Sync** | File-based cloud storage (Dropbox/GDrive) | Zero infrastructure, user-controlled, privacy-preserving |

### 9.3 Data Flow

1. **User edits a note** in TipTap editor (React)
2. On save (debounced auto-save or explicit), `editor.getJSON()` produces a JSON object
3. React calls a Tauri command: `save_note(id, json_string)`
4. Rust backend:
   a. Validates the JSON
   b. Extracts plain text for FTS indexing
   c. Updates the `notes` table with the new content and `updated_at`
   d. Updates the FTS5 index
   e. If images were added, writes them to `assets/{note-uuid}/`
5. SQLite WAL automatically handles concurrent reads during writes
6. On app close, WAL is checkpointed for clean sync
7. Cloud service (Dropbox/GDrive) detects file changes and syncs

### 9.4 Key Design Decisions

1. **rusqlite over sqlx:** For a desktop/mobile app, synchronous database access is simpler and sufficient. rusqlite provides full access to SQLite features including custom functions, virtual tables, and SQLCipher. sqlx's compile-time query checking is valuable for web servers but adds build complexity without proportional benefit here.

2. **Fractional indexing for sort order:** Use REAL values (e.g., 1.0, 2.0, 1.5) for `sort_order` to allow drag-and-drop reordering without renumbering all siblings. When inserting between two items, take the average of their sort orders.

3. **Soft delete for notes:** Set `deleted_at` timestamp instead of `DELETE`. This prevents sync issues where a deleted note reappears from another device. Periodically purge soft-deleted notes older than 30 days.

4. **Debounced auto-save:** Save after 1-2 seconds of inactivity, not on every keystroke. This reduces database writes and sync frequency.

5. **Asset immutability:** Images and attachments are never modified after creation. To "replace" an image, create a new asset and update the reference. This simplifies encryption, sync, and conflict resolution.

---

## 10. Open Questions and Future Research

### 10.1 Time Tracking

Time tracking within notes/tasks requires further research:

- **Data model:** Where does time tracking data live? Options: (a) as attributes on TaskItem nodes in TipTap JSON, (b) as a separate `time_entries` table in SQLite with foreign key to `note_tasks`
- **UI:** How is time tracking presented? Options: (a) inline timer in the editor, (b) separate time tracking panel, (c) both
- **Timer state:** Active timers need to persist across app restarts. Store the timer start time in SQLite; calculate elapsed time on display.
- **Recommendation:** Use a separate `time_entries` table for flexibility and queryability (e.g., "total time spent this week"). Store a reference to the TipTap node ID in the time entry for linking.

### 10.2 Sync Robustness

- **WAL checkpoint timing:** When exactly should the WAL be checkpointed? On every save? On app close? On a timer? Too frequent checkpointing reduces write performance; too infrequent risks syncing a WAL file that the other device cannot read.
- **Conflict detection UI:** What does the merge UI look like when a database conflict is detected? Research existing implementations (Git merge tools, Notion's conflict resolution).
- **cr-sqlite evaluation:** Conduct a deeper evaluation of cr-sqlite for automatic CRDT-based merging. Test with the rnotes schema to verify compatibility and performance.

### 10.3 Search

- **FTS5 configuration:** Which tokenizer to use? Default Unicode61? ICU for international text? Porter stemming for English?
- **Search scope:** Search note titles only? Titles + content? Include archived notes?
- **Search ranking:** How to rank results? BM25 (FTS5 default)? Boost recent notes?

### 10.4 Export and Import

- **Export formats:** Markdown, HTML, PDF, plain text. TipTap's JSON can be programmatically converted to these formats.
- **Import from other apps:** Obsidian (Markdown), Notion (Markdown/HTML export), Bear (TextBundle). Research format-specific importers.
- **Data portability:** The TipTap JSON format is well-documented but app-specific. Consider generating Markdown as a secondary export for portability.

### 10.5 Performance Testing

- **Database size:** Test with 1,000, 5,000, and 10,000 notes to verify query performance, FTS5 search speed, and tree rendering time.
- **Large notes:** Test notes with 10,000+ words, 50+ images, and complex nested structures.
- **Sync performance:** Test cloud sync with large databases (>50MB) to identify the point where file-based sync becomes impractical.

### 10.6 Plugin/Extension Architecture

- Should rnotes-app support user plugins? If so, how do plugins interact with the storage layer?
- TipTap's extension system supports custom extensions -- can this be exposed to users?
- Research Obsidian's plugin architecture for inspiration.

### 10.7 Backup Strategy

- **Automatic backups:** Periodically copy the database to a backup location (e.g., `rnotes-backup-2026-03-07.db`)
- **Backup rotation:** Keep last N backups, delete older ones
- **Export-based backup:** Generate a ZIP file containing all notes as Markdown + assets (similar to Bear's `.bearbk` format)

### 10.8 Accessibility

- Research TipTap's accessibility support (ARIA attributes, keyboard navigation)
- Mantine has strong accessibility defaults -- verify they work correctly in Tauri's webview
- Screen reader compatibility testing needed

---

## References

- [Liveblocks: Which rich text editor framework in 2025](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [TipTap Editor Documentation](https://tiptap.dev/docs/editor/core-concepts/introduction)
- [TipTap JSON/HTML Output Guide](https://tiptap.dev/docs/guides/output-json-html)
- [TipTap Extensions Overview](https://tiptap.dev/docs/editor/extensions/overview)
- [Lexical Documentation](https://lexical.dev/docs/intro)
- [Lexical Nodes Concept](https://lexical.dev/docs/concepts/nodes)
- [Slate.js Repository](https://github.com/ianstormtaylor/slate)
- [How SQLite made Notion 30% Faster](https://newsletter.betterstack.com/p/how-sqlite-made-notion-30-faster)
- [Bear Notes FAQ: Where are notes located](https://bear.app/faq/where-are-bears-notes-located/)
- [Bear Blog: Encryption and your private data](https://blog.bear.app/2023/10/encryption-bear-and-your-private-data/)
- [Makers' Den: React UI libraries in 2025](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [Mantine Documentation](https://mantine.dev/)
- [Mantine Tree Component](https://mantine.dev/core/tree/)
- [shadcn/ui Sidebar Component](https://ui.shadcn.com/docs/components/radix/sidebar)
- [Mantine vs shadcn/ui Comparison (SaaSIndie)](https://saasindie.com/blog/mantine-vs-shadcn-ui-comparison)
- [Tauri SQL Plugin Documentation](https://v2.tauri.app/plugin/sql/)
- [Tauri 2.0 Mobile Development](https://v2.tauri.app/develop/)
- [Embedding SQLite in a Tauri Application](https://dezoito.github.io/2025/01/01/embedding-sqlite-in-a-tauri-application.html)
- [Building a Local-First Password Manager with Tauri + SQLCipher](https://mhmtsr.medium.com/building-a-local-first-password-manager-tauri-rust-sqlx-and-sqlcipher-09d0134db5bc)
- [SQLCipher Documentation](https://www.zetetic.net/sqlcipher/)
- [Rust ORMs in 2026: Diesel vs SQLx vs SeaORM vs Rusqlite](https://aarambhdevhub.medium.com/rust-orms-in-2026-diesel-vs-sqlx-vs-seaorm-vs-rusqlite-which-one-should-you-actually-use-706d0fe912f3)
- [redb: Embedded key-value database in pure Rust](https://github.com/cberner/redb)
- [sled: Embedded database in Rust](https://github.com/spacejam/sled)
- [SurrealDB Embedded](https://surrealdb.com/docs/surrealdb/embedding/rust)
- [cr-sqlite: Convergent, Replicated SQLite](https://github.com/vlcn-io/cr-sqlite)
- [SQLite Sync (sqlite.ai)](https://www.sqlite.ai/sqlite-sync)
- [Obsidian Sync Architecture (DeepWiki)](https://deepwiki.com/obsidianmd/obsidian-help/2-obsidian-sync-service)
- [Remotely Save: Obsidian sync plugin](https://github.com/remotely-save/remotely-save)
- [Tauri + React + Mantine Template](https://github.com/U-C-S/react-mantine-tauri-template)
- [shadcn/ui Tree View (community)](https://github.com/neigebaie/shadcn-ui-tree-view)
