# Changelog

All notable changes to rnotes-app are documented here.

## [0.0.4] - 2026-04-29

### Added

- **Sidebar tree keyboard navigation** — navigate visible nodes with arrow keys, expand/collapse folders with Right/Left, open notes or toggle folders with Enter, rename with F2, archive with Delete; `Mod+1` focuses the tree on the active note
- **Create inbox task** — a `+ New Task` button in the Tasks tab opens a modal to create tasks without needing a note; tasks are stored in a hidden `__rnotes_inbox__` note (filtered from the sidebar)
- **Tasks tab full-width layout** — the sidebar is hidden automatically when the Tasks tab is active, giving more room to the task overview

### Fixed

- Tree navigation focus and keyboard handling edge cases
- Task lists view rendering in the overview panel

## [0.0.3] - 2026-04-26

### Added

- **Hard delete from archive** — permanently delete a note (and all its descendants) from the Archive panel via a "Delete forever" button with a confirmation modal
- **Export all data** — save a full `.rnotes` ZIP backup (notes, tasks, assets, metadata) from Settings → Data
- **Import data** — restore a `.rnotes` backup with three strategies: *Replace* (wipe and reimport), *Add missing* (skip existing notes), and *Merge* (update existing notes from backup)
- **Export folder subtree** — choose a specific folder subtree to export instead of always exporting everything
- **Keyboard shortcuts: line operations** — `Cmd+D` duplicates the current block, `Cmd+Y` deletes the current block
- **Keyboard shortcut: title search** — `Cmd+Shift+N` opens Global Search with the title-only filter pre-selected (`Cmd+Alt+N` now creates a new folder)
- **Keyboard shortcut: sidebar search** — `Cmd+1` focuses the sidebar search input
- **Quote/wrap shortcuts** — typing `"`, `'`, or `` ` `` with a selection wraps the text; for backtick: single-line wraps as inline code, a second press promotes to a code block; multi-line selection goes directly to a code block

### Fixed

- Archive note counter now updates immediately after a permanent deletion
- Archive panel actions replaced with icon-only buttons (cleaner layout)

## [0.0.2] - 2026-04-21

v0.0.2

### Added

- **Auto-updater** — Added and configured the Tauri updater so the app can receive updates automatically.
- **Copy note** — New option to duplicate a note.
- **Table cell merge/split** — Merge and split table cells directly in the editor.
- **Copy raw / Copy as Markdown / Paste raw** — New clipboard actions for working with raw or Markdown content.
- **Auto-detect code block language** — Code blocks now automatically detect the language using lowlight.
- **Back-to-top button** — A button appears in the note editor to quickly scroll back to the top.
- **Collapsible Table of Contents** — TOC nodes can now be collapsed/expanded.
- **Auto-focus rename input** — The rename field is automatically focused when creating a note or folder.

### Fixed

- **Find & search** — Scrolls to the first match when finding, and the global search query is now threaded through to the editor.
- **Tree expansion state** — Sidebar tree expansion state is persisted across sessions.
- **Title save on tab switch** — Pending title changes are flushed when switching tabs, preventing data loss.
- **Code block paste** — Multi-line text pasted inside code blocks now preserves all lines.
- **Task sync** — Fixed task synchronization and the task overview.
- **Table styling** — Reduced cell padding to 4px 8px for more compact tables; additional table style fixes.
- **Date picker** — Prevented popover jitter by disabling shift/flip positioning middlewares.
- **Icons** — Minor icon adjustments throughout the UI.

## [0.0.1] - 2026-04-18

Initial release.
