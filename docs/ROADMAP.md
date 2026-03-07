# rnotes-app -- Roadmap

This document breaks the project into sequential phases. Each phase builds on the previous one and ends with a working, testable state of the application.

---

## Phase 1: Project Scaffolding and Core Architecture

**Goal:** Set up the project structure, tooling, and foundational layers so that all subsequent work has a stable base to build on.

**Dependencies:** None (starting point).

### Tasks

1. **Initialize Tauri 2.0 project with React + TypeScript frontend** -- set up the monorepo structure with Rust backend and React frontend using Vite.
2. **Configure Mantine UI library** -- install Mantine v7+, set up the theme provider, and configure CSS modules.
3. **Set up SQLite database layer in Rust** -- integrate rusqlite, create the database initialization logic, and define the schema (notes, assets, note_tasks, FTS5 virtual table).
4. **Implement Tauri IPC command layer** -- define the command interface between React and Rust for note operations (create, read, update, delete, list).
5. **Build the application shell layout** -- implement the Mantine AppShell with a sidebar (for the future tree) and a main content area (for the future editor).
6. **Set up development tooling** -- configure linting (ESLint, clippy), formatting (Prettier, rustfmt), and build scripts.

### Acceptance Criteria

- The application launches and displays the AppShell layout with sidebar and content area.
- The SQLite database is created on first launch with the correct schema.
- A round-trip Tauri command works (e.g., create a note from the frontend, read it back from the database).
- The project builds cleanly with no warnings from linters.

---

## Phase 2: Core Note Editing

**Goal:** Integrate the TipTap rich text editor with basic formatting and connect it to the SQLite storage backend.

**Dependencies:** Phase 1 (project structure, database layer, IPC commands, AppShell).

### Tasks

1. **Integrate TipTap editor with React** -- install `@tiptap/react` and `@tiptap/starter-kit`, render the editor in the main content area.
2. **Implement basic text formatting** -- enable bold, italic, strikethrough, and text size marks in the editor.
3. **Implement paragraph formatting** -- enable heading nodes (H1-H6) with a formatting toolbar or keyboard shortcuts.
4. **Implement bullet lists and ordered lists** -- enable BulletList and OrderedList extensions.
5. **Implement hyperlink support** -- enable the Link extension with insert/edit/remove link UI.
6. **Build the editor toolbar** -- create a Mantine-based toolbar with buttons for all enabled formatting options.
7. **Connect editor to storage backend** -- implement auto-save (debounced) that calls `editor.getJSON()` and sends the content to Rust via Tauri command for SQLite storage.
8. **Implement note loading** -- load a note's TipTap JSON from SQLite and restore it in the editor via `setContent()`.

### Acceptance Criteria

- A note can be created, edited with rich text formatting, and saved to SQLite.
- Reopening a note restores all formatting exactly as it was saved.
- Auto-save triggers after a brief pause in editing.
- All basic formatting (bold, italic, strikethrough, headings, lists, links) works correctly.
- The toolbar reflects the current formatting state of the cursor position.

---

## Phase 3: Note Management and Tree Structure

**Goal:** Implement hierarchical note/folder organization with full CRUD operations and a navigable tree sidebar.

**Dependencies:** Phase 2 (editor and storage must be working so notes can be created and viewed).

### Tasks

1. **Build the note tree sidebar** -- use Mantine Tree component to display notes and folders in a hierarchical structure, populated from SQLite.
2. **Implement folder creation and management** -- allow creating, renaming, and deleting folders in the tree.
3. **Implement note creation from the tree** -- create new notes within folders, with the tree updating immediately.
4. **Implement note deletion (soft delete)** -- archive notes by setting a `deleted_at` timestamp; remove from tree display but retain in database.
5. **Implement note selection and navigation** -- clicking a note in the tree loads it in the editor; track the active note.
6. **Implement drag and drop in the tree** -- allow reordering notes/folders and moving items between folders using fractional indexing for sort order.
7. **Implement note renaming** -- inline rename or dialog-based rename for notes and folders in the tree.
8. **Implement archive view** -- a separate view or filter to see and restore archived notes.

### Acceptance Criteria

- Notes and folders appear in a hierarchical tree in the sidebar.
- Notes can be created inside any folder and opened by clicking.
- Drag and drop reorders items and moves them between folders; order persists after restart.
- Deleting a note archives it (soft delete); it can be viewed and restored from an archive view.
- The tree state (expansion, selection) is consistent and responsive.

---

## Phase 4: Advanced Editing Features

**Goal:** Add the remaining rich text capabilities: tables, images, code blocks, quotes, and collapsible sections.

**Dependencies:** Phase 2 (basic editor must be working), Phase 3 (note management for testing with multiple notes).

### Tasks

1. **Implement code blocks with syntax highlighting** -- integrate `@tiptap/extension-code-block-lowlight` with language selection.
2. **Implement blockquote formatting** -- enable the Blockquote extension with toolbar button and keyboard shortcut.
3. **Implement table support** -- integrate `@tiptap/extension-table` with insert table dialog, add/remove rows and columns, and cell selection.
4. **Implement image embedding** -- integrate `@tiptap/extension-image` with inline positioning; handle image upload, storage to the assets directory, and loading from assets.
5. **Implement asset management in Rust backend** -- build the asset read/write layer that stores images in `assets/{note-uuid}/` and serves them to the frontend.
6. **Implement collapsible sections** -- integrate the TipTap Details extension for expandable/collapsible content blocks.
7. **Add toolbar controls for advanced features** -- extend the editor toolbar with buttons/menus for tables, images, code blocks, quotes, and collapsible sections.

### Acceptance Criteria

- Code blocks render with syntax highlighting for common languages.
- Tables can be inserted, edited (add/remove rows/columns), and content persists correctly.
- Images can be embedded inline, are stored in the assets directory, and display correctly after reopening a note.
- Blockquotes and collapsible sections work and persist through save/load cycles.
- All new features are accessible from the toolbar.

---

## Phase 5: Task Lists and Notifications

**Goal:** Add task list functionality within notes, including checkbox items and timed notification reminders.

**Dependencies:** Phase 2 (editor), Phase 3 (note management for the note_tasks table relationship).

### Tasks

1. **Implement task lists in the editor** -- integrate `@tiptap/extension-task-list` and `@tiptap/extension-task-item` for checkbox-based task items within notes.
2. **Implement task extraction to database** -- when a note is saved, extract task items from the TipTap JSON and sync them to the `note_tasks` table in SQLite.
3. **Implement due dates on tasks** -- extend task items with a due date attribute; provide a UI to set/edit the due date.
4. **Implement notification scheduling in Rust** -- use Tauri's notification API or OS-level scheduling to trigger reminders at the specified `notify_at` time.
5. **Implement full-text search** -- build the search UI (input + results list) connected to the FTS5 index; extract plain text from TipTap JSON for indexing on save.
6. **Implement a task overview panel** -- a view that aggregates all tasks across notes, filterable by status (open/completed) and sorted by due date.

### Acceptance Criteria

- Task lists with checkboxes can be created within notes; checked/unchecked state persists.
- Tasks with due dates trigger OS notifications at the scheduled time.
- Full-text search returns relevant notes with highlighted matches.
- The task overview panel shows all tasks across all notes with correct status.

---

## Phase 6: Polish and Packaging

**Goal:** Refine the user experience, fix edge cases, and prepare the application for distribution.

**Dependencies:** All previous phases.

### Tasks

1. **Implement keyboard shortcuts** -- add shortcuts for common actions (new note, save, search, formatting) using Mantine's `useHotkeys`.
2. **Add application settings panel** -- data directory location, theme (light/dark), auto-save interval, editor preferences.
3. **Implement error handling and user feedback** -- toast notifications for save errors, confirmation dialogs for destructive actions, graceful handling of database errors.
4. **Performance optimization** -- profile and optimize large note rendering, tree with many items, and search with many results.
5. **Implement WAL checkpoint management** -- ensure the SQLite WAL is checkpointed on app close for data integrity and future sync compatibility.
6. **Build application installers** -- configure Tauri bundling for macOS (.dmg), Windows (.msi), and Linux (.AppImage/.deb).
7. **End-to-end testing** -- test all features together: create notes in folders, edit with all formatting types, use tasks, search, drag and drop, archive and restore.

### Acceptance Criteria

- All keyboard shortcuts work and are discoverable (e.g., in a help menu or settings).
- The application handles errors gracefully without crashing or losing data.
- The application starts quickly and editing feels responsive with 100+ notes.
- Installable packages are produced for at least macOS and one other platform.
- All features from previous phases continue to work correctly together.

---

## Feature-to-Phase Mapping

| Feature | Phase |
|---------|-------|
| Note CRUD (create, read, update, delete) | Phase 2 + Phase 3 |
| Rich text (bold, italic, strikethrough, text size) | Phase 2 |
| Paragraph formatting (headings) | Phase 2 |
| Bullet lists and ordered lists | Phase 2 |
| Hyperlinks | Phase 2 |
| Auto-save | Phase 2 |
| Note tree structure with folders | Phase 3 |
| Drag and drop in tree | Phase 3 |
| Note archiving | Phase 3 |
| Code blocks with syntax highlighting | Phase 4 |
| Quote blocks | Phase 4 |
| Tables | Phase 4 |
| Embedded images (inline positioning) | Phase 4 |
| Collapsible sections | Phase 4 |
| Task lists with checkboxes | Phase 5 |
| Task notifications (timed reminders) | Phase 5 |
| Full-text search | Phase 5 |
| Keyboard shortcuts | Phase 6 |
| Application settings | Phase 6 |
| Installers and packaging | Phase 6 |

## Future Items (Not Scheduled)

The following are documented in `PROJECT.md` under Future Roadmap. They have no tasks assigned because they depend on the completion of the core application and require additional research.

- **Data encryption at rest** -- SQLCipher + per-file asset encryption
- **Mobile companion app** -- Tauri 2.0 iOS/Android targets
- **Cloud sync** -- Dropbox/Google Drive file-based sync with conflict resolution
- **Time tracking** -- timer and time entry tracking on tasks/notes
