import { test as base, type Page } from "@playwright/test";

interface Note {
  id: string;
  parent_id: string | null;
  title: string;
  content: string | null;
  sort_order: number;
  is_folder: boolean;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

const SEED_NOTE: Note = {
  id: "test-note-1",
  parent_id: null,
  title: "Test Note",
  content: "{}",
  sort_order: 0,
  is_folder: false,
  deleted_at: null,
  created_at: Date.now(),
  updated_at: Date.now(),
};

async function installTauriMock(page: Page) {
  await page.addInitScript((seedNote: Note) => {
    type Note = {
      id: string;
      parent_id: string | null;
      title: string;
      content: string | null;
      sort_order: number;
      is_folder: boolean;
      deleted_at: number | null;
      created_at: number;
      updated_at: number;
    };

    type NoteTaskWithNote = {
      id: string;
      note_id: string;
      note_title: string;
      content: string;
      is_checked: boolean;
      notify_at: number | null;
      notified_at: number | null;
      created_at: number;
      updated_at: number;
    };

    const notes = new Map<string, Note>();
    notes.set(seedNote.id, { ...seedNote });
    const tasks = new Map<string, NoteTaskWithNote>();

    let callbackId = 0;

    (window as any).__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      transformCallback: (callback?: (payload: any) => void) => {
        const id = callbackId++;
        if (callback) {
          (window as any)[`_${id}`] = callback;
        }
        return id;
      },
      invoke: (cmd: string, args?: Record<string, unknown>) => {
        // Handle Tauri event system commands
        if (cmd === "plugin:event|listen" || cmd === "plugin:event|emit") {
          return Promise.resolve();
        }

        switch (cmd) {
          case "create_note": {
            const now = Date.now();
            const note: Note = {
              id: crypto.randomUUID(),
              parent_id: (args?.parentId as string) ?? null,
              title: (args?.title as string) ?? "Untitled",
              content: null,
              sort_order: notes.size,
              is_folder: (args?.isFolder as boolean) ?? false,
              deleted_at: null,
              created_at: now,
              updated_at: now,
            };
            notes.set(note.id, note);
            return Promise.resolve(note);
          }

          case "get_note": {
            const id = args?.id as string;
            const note = notes.get(id);
            if (!note) {
              return Promise.reject(`Note not found: ${id}`);
            }
            return Promise.resolve({ ...note });
          }

          case "list_notes": {
            const includeDeleted = args?.includeDeleted as boolean;
            const rows = Array.from(notes.values())
              .filter((n) => includeDeleted || !n.deleted_at)
              .map(({ content: _, ...row }) => row);
            return Promise.resolve(rows);
          }

          case "update_note": {
            const id = args?.id as string;
            const note = notes.get(id);
            if (!note) {
              return Promise.reject(`Note not found: ${id}`);
            }
            if (args?.title !== undefined) note.title = args.title as string;
            if (args?.content !== undefined)
              note.content = args.content as string;
            note.updated_at = Date.now();
            return Promise.resolve();
          }

          case "delete_note": {
            const id = args?.id as string;
            const note = notes.get(id);
            if (!note) {
              return Promise.reject(`Note not found: ${id}`);
            }
            note.deleted_at = Date.now();
            note.updated_at = Date.now();
            return Promise.resolve();
          }

          case "rename_note": {
            const id = args?.id as string;
            const note = notes.get(id);
            if (!note) {
              return Promise.reject(`Note not found: ${id}`);
            }
            note.title = args?.title as string;
            note.updated_at = Date.now();
            return Promise.resolve();
          }

          case "delete_note_tree": {
            const id = args?.id as string;
            const now = Date.now();
            const softDelete = (noteId: string) => {
              const n = notes.get(noteId);
              if (!n) return;
              n.deleted_at = now;
              n.updated_at = now;
              // Recursively soft-delete children
              for (const child of notes.values()) {
                if (child.parent_id === noteId) {
                  softDelete(child.id);
                }
              }
            };
            softDelete(id);
            return Promise.resolve();
          }

          case "move_note": {
            const id = args?.id as string;
            const note = notes.get(id);
            if (!note) {
              return Promise.reject(`Note not found: ${id}`);
            }
            note.parent_id = (args?.newParentId as string | null) ?? null;
            note.sort_order = args?.newSortOrder as number;
            note.updated_at = Date.now();
            return Promise.resolve();
          }

          case "restore_note": {
            const id = args?.id as string;
            const note = notes.get(id);
            if (!note) {
              return Promise.reject(`Note not found: ${id}`);
            }
            note.deleted_at = null;
            note.updated_at = Date.now();
            return Promise.resolve();
          }

          case "save_image": {
            // Return a fake relative asset path in the test environment.
            const noteId = args?.noteId as string;
            const filename = args?.filename as string;
            const ext = filename.split(".").pop() ?? "png";
            return Promise.resolve(`assets/${noteId}/mock-image.${ext}`);
          }

          case "get_image_url": {
            // Return a placeholder data-uri URL for test environment display.
            const assetPath = args?.assetPath as string;
            return Promise.resolve(
              `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#${assetPath}`,
            );
          }

          case "get_note_tasks": {
            // Return empty task list in the mock environment.
            return Promise.resolve([]);
          }

          case "get_all_tasks": {
            const allTasks = Array.from(tasks.values()).filter((t) => {
              const note = notes.get(t.note_id);
              return note && !note.deleted_at;
            });
            return Promise.resolve(allTasks);
          }

          case "update_task_checked": {
            const taskId = args?.taskId as string;
            const isChecked = args?.isChecked as boolean;
            const task = tasks.get(taskId);
            if (!task) {
              return Promise.reject(`Task not found: ${taskId}`);
            }
            task.is_checked = isChecked;
            task.updated_at = Date.now();
            return Promise.resolve();
          }

          case "add_mock_task": {
            // Internal helper for tests to seed tasks into the mock store.
            const task = args as unknown as NoteTaskWithNote;
            tasks.set(task.id, { ...task });
            return Promise.resolve();
          }

          default:
            console.warn(`Unhandled Tauri command: ${cmd}`, args);
            return Promise.resolve();
        }
      },
    };
  }, SEED_NOTE);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await installTauriMock(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";
