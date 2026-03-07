<research_objective>
Thoroughly research and document the optimal data storage architecture for "rnotes-app" - a desktop note-taking and knowledge management application built with Rust + Tauri.

The research must evaluate storage approaches considering these critical future requirements:
- Encryption of stored data (planned for future)
- Cross-platform sync via cloud storage (Dropbox, Google Drive, or similar)
- Mobile app companion that shares the same data format and syncs with desktop

This research will directly inform architecture decisions and task planning for the entire project.
</research_objective>

<context>
rnotes-app is a Rust + Tauri desktop application for note-taking and knowledge management.

Core features the storage layer must support:
- Rich text notes with: bold, italic, text size, strikethrough, headings, paragraphs
- Code blocks and code embedding
- Quote embedding
- Expandable/collapsible paragraphs (sections)
- Embedded images (inline, with positioning/movement within text)
- Hyperlinks
- Tables
- Bullet lists and enumerations
- Task lists with timed notifications
- Note/folder tree structure with drag & drop reordering
- Adding, editing, removing, and archiving notes

Future considerations (must not block, but architecture should accommodate):
- Data encryption at rest
- Mobile app (iOS/Android) with same functionality
- Cloud sync between desktop and mobile via file-based cloud services (Dropbox, Google Drive, etc.)
- Time tracking capabilities within notes/tasks
</context>

<scope>
Research and compare at minimum these storage approaches:

1. **Individual files per note** (like Obsidian/Zettlr)
   - File format options: Markdown, custom JSON, HTML, or hybrid
   - How to store rich content (images, metadata, tree structure)
   - Pros/cons for sync, encryption, conflict resolution

2. **SQLite database** (single file)
   - Schema design considerations
   - How rich content and images are stored
   - Pros/cons for sync, encryption, conflict resolution

3. **Hybrid approach** (SQLite for metadata + files for content/assets)
   - How to split concerns
   - Pros/cons for sync, encryption, conflict resolution

4. **Embedded/local database** (beyond SQLite)
   - Research databases that could fulfill the requirements (e.g., DuckDB, SurrealDB, Redb, RocksDB, sled, or any other fitting DB)
   - Query and search capabilities (full-text search, structured queries)
   - Rust ecosystem support and maturity
   - Pros/cons for sync, encryption, conflict resolution
   - Compare with SQLite - what additional value does a different DB bring?

For each approach, evaluate:
- How rich text content is represented (document model)
- How images and binary assets are stored
- How the note tree/folder hierarchy is maintained
- How encryption could be layered on
- How cloud file sync (Dropbox/GDrive) would work - conflict handling
- How a mobile app would read/write the same data
- Performance with large note collections (1000+ notes)
- Complexity of implementation in Rust

Also research:
- **Document model / rich text format**: What format represents the rich content internally?
  - ProseMirror/TipTap JSON model
  - Markdown with extensions
  - Custom AST/JSON
  - How does the chosen format handle: collapsible sections, inline images, tables, task lists
- **Frontend**: React is the chosen framework. No need to compare frameworks.
- **Rich text editor libraries for React**: What editor component to use (TipTap, Slate, Lexical, ProseMirror, etc.) - evaluate through the lens of React ecosystem support, and how their document model maps to storage
- **React component library**: Compare UI component libraries for the app shell (MUI, Ant Design, Mantine, Chakra UI, shadcn/ui, Radix, etc.) - evaluate based on: Tauri compatibility, customizability, bundle size, active maintenance, and fit for a desktop-style note-taking app
</scope>

<deliverables>
Save all findings to: `./docs/research/001-data-storage-architecture.md`

Structure the document as follows:

## 1. Executive Summary
Brief recommendation with rationale.

## 2. Document Model Research
How rich content is represented internally. Compare formats. Recommend one.

## 3. Storage Approach Comparison
Detailed comparison table and analysis of each approach (individual files, SQLite, hybrid).

## 4. Rich Text Editor Research
Compare editor libraries (TipTap, Slate, Lexical, etc.) and their fit with Tauri + chosen storage.

## 5. React Component Library Recommendation
Compare UI component libraries (MUI, Ant Design, Mantine, shadcn/ui, Radix, etc.) for building the app shell, sidebar, tree view, toolbar, dialogs. Recommend one with rationale.

## 6. Sync & Conflict Resolution Strategy
How cloud sync would work with the recommended approach. Conflict handling.

## 7. Encryption Path
How encryption can be added later without major refactoring.

## 8. Mobile Compatibility
How the chosen architecture supports a future mobile app.

## 9. Recommended Architecture
Final recommendation tying everything together with a diagram (ASCII).

## 10. Open Questions & Future Research
Items that need further investigation (including time tracking capabilities).
</deliverables>

<evaluation_criteria>
- Each storage approach must be evaluated against ALL future requirements (encryption, sync, mobile)
- Recommendations must include concrete reasoning, not just opinions
- Trade-offs must be explicitly stated
- The document model choice must be compatible with the chosen editor library
- Research should reference real-world examples (how Obsidian, Notion, Bear, etc. solve these problems)
- The final recommendation must form a coherent, implementable architecture
</evaluation_criteria>

<verification>
Before completing, verify:
- All four storage approaches are compared with pros/cons
- Document model recommendation is compatible with at least 2 editor libraries
- Sync strategy addresses conflict resolution specifically
- Encryption can be added without rewriting the storage layer
- Mobile app can use the same data format
- The recommended architecture section provides a clear, actionable summary
- All sections in the deliverables structure are filled out
</verification>
