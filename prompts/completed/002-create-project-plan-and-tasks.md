<objective>
Based on the research document at `./docs/research/001-data-storage-architecture.md`, create a comprehensive project documentation and high-level task breakdown for building rnotes-app.

Read the CLAUDE.md for project conventions before starting.
</objective>

<context>
rnotes-app is a Rust + Tauri desktop note-taking and knowledge management application.

The research phase has already been completed and the architecture decisions are documented.
This prompt creates the project documentation and actionable task breakdown.

Complete feature list:
- Adding, editing, removing, archiving notes
- Rich text editing:
  - Text adjustments: size, bold, italic, strikethrough
  - Code embedding and code blocks
  - Paragraph formatting with headings
  - Quote embedding
  - Expanding and collapsing paragraphs/sections
- Notes tree structure with folders
- Drag & drop notes/folders in tree structure
- Task lists with timed notifications
- Bullet lists and enumerations
- Embedded images with inline positioning and movement
- Hyperlinks
- Tables

Future (document but don't plan tasks for):
- Data encryption at rest
- Mobile companion app with sync
- Cloud sync via Dropbox/Google Drive
- Time tracking capabilities
</context>

<requirements>
Thoroughly analyze the research document to extract architecture decisions, then create:

1. **Project Overview Document** (`./docs/PROJECT.md`)
   - App description and vision
   - Architecture overview (from research)
   - Tech stack (Rust, Tauri, chosen frontend framework, chosen editor library, chosen storage approach)
   - Feature list with priority levels (P0 = MVP, P1 = important, P2 = nice-to-have)
   - Future roadmap items (encryption, mobile, sync, time tracking)

2. **High-Level Task Breakdown** (`./docs/ROADMAP.md`)
   - Organize into phases/milestones
   - Each phase should have:
     - Goal description
     - List of tasks with brief descriptions
     - Dependencies on other phases
     - Acceptance criteria for the phase

   Suggested phases (adapt based on research findings):
   - Phase 1: Project scaffolding & basic architecture
   - Phase 2: Core note editing (rich text editor integration)
   - Phase 3: Note management (CRUD, tree structure, folders)
   - Phase 4: Advanced editing features (tables, images, code blocks)
   - Phase 5: Task lists & notifications
   - Phase 6: Polish & packaging

   Keep tasks at a high level (each task = roughly a day or two of work).
   Don't go into implementation details - focus on WHAT, not HOW.
</requirements>

<output>
Create these files:
- `./docs/PROJECT.md` - Project overview and architecture
- `./docs/ROADMAP.md` - Phased task breakdown

Both documents should be clear enough that someone new to the project can understand what's being built and what to work on next.
</output>

<verification>
Before completing, verify:
- PROJECT.md references the architecture decisions from the research
- ROADMAP.md phases have clear dependencies and acceptance criteria
- All features from the feature list are covered in at least one phase
- Future items are documented but not included in phase tasks
- Documents are consistent with each other
- No phase is unreasonably large (max 8-10 tasks per phase)
</verification>

<success_criteria>
- Both documents exist and are well-structured
- Every feature is assigned to a phase
- Phases are ordered logically with dependencies noted
- A developer reading these docs knows exactly what to build and in what order
</success_criteria>
