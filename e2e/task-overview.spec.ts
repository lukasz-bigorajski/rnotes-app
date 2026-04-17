import { test, expect } from "./fixtures/tauri-mock";
import type { Page } from "@playwright/test";

// Helper to seed a task via the mock's add_mock_task command
async function seedTask(
  page: Page,
  task: {
    id: string;
    note_id: string;
    note_title: string;
    content: string;
    is_checked: boolean;
    notify_at: number | null;
  },
) {
  await page.evaluate(
    ({ task }) => {
      return (window as any).__TAURI_INTERNALS__.invoke("add_mock_task", task);
    },
    { task: { ...task, notified_at: null, created_at: Date.now(), updated_at: Date.now() } },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("task overview button exists in sidebar", async ({ page }) => {
  const btn = page.getByTestId("task-overview-btn");
  await expect(btn).toBeVisible();
});

test("clicking task overview button shows the task overview page", async ({ page }) => {
  await page.getByTestId("task-overview-btn").click();
  const overview = page.getByTestId("task-overview");
  await expect(overview).toBeVisible();
});

test("task overview displays empty state when there are no tasks", async ({ page }) => {
  await page.getByTestId("task-overview-btn").click();
  const empty = page.getByTestId("task-overview-empty");
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("No tasks found");
});

test("tasks appear in the overview when seeded", async ({ page }) => {
  await seedTask(page, {
    id: "task-1",
    note_id: "test-note-1",
    note_title: "Test Note",
    content: "Buy groceries",
    is_checked: false,
    notify_at: null,
  });

  await page.getByTestId("task-overview-btn").click();
  await expect(page.getByTestId("task-overview")).toBeVisible();
  // The default filter is "Open" so this unchecked task should be visible
  await expect(page.getByText("Buy groceries")).toBeVisible();
});

test("status filter Completed hides unchecked tasks", async ({ page }) => {
  await seedTask(page, {
    id: "task-open",
    note_id: "test-note-1",
    note_title: "Test Note",
    content: "Open task",
    is_checked: false,
    notify_at: null,
  });

  await page.getByTestId("task-overview-btn").click();
  await expect(page.getByText("Open task")).toBeVisible();

  // Switch to "Completed" filter — Mantine SegmentedControl uses hidden radio inputs
  // with visible labels. Click by label text within the segmented control.
  await page.locator('[data-testid="task-overview"] label', { hasText: "Completed" }).click();

  // Open task should no longer be visible, empty state should show
  await expect(page.getByTestId("task-overview-empty")).toBeVisible();
});

test("clicking a note title link navigates to that note in the editor", async ({ page }) => {
  await seedTask(page, {
    id: "task-link",
    note_id: "test-note-1",
    note_title: "Test Note",
    content: "Task in Test Note",
    is_checked: false,
    notify_at: null,
  });

  await page.getByTestId("task-overview-btn").click();
  await expect(page.getByText("Task in Test Note")).toBeVisible();

  // Click the note link
  await page.getByTestId("task-note-link").first().click();

  // Should navigate back to editor and show the note editor
  await expect(page.locator(".tiptap")).toBeVisible();
  // Task overview should no longer be visible
  await expect(page.getByTestId("task-overview")).not.toBeVisible();
});

test("clicking Notes tab in sidebar switches back to editor view", async ({ page }) => {
  await page.getByTestId("task-overview-btn").click();
  await expect(page.getByTestId("task-overview")).toBeVisible();

  // Click the Notes tab icon to go back to notes view
  await page.getByRole("button", { name: "Notes" }).click();

  // Note list should be visible, click a note
  await page.getByText("Test Note").click();

  // Editor should be visible, task overview should not
  await expect(page.locator(".tiptap")).toBeVisible();
  await expect(page.getByTestId("task-overview")).not.toBeVisible();
});

// Helper to seed note content with a taskItem that already has a stable task_id attr
// (as the backend would stamp it after sync_tasks).
async function setNoteContent(page: Page, noteId: string, content: object) {
  await page.evaluate(
    ({ noteId, content }) => {
      return (window as any).__TAURI_INTERNALS__.invoke("update_note", {
        id: noteId,
        title: "Test Note",
        content: JSON.stringify(content),
        plainText: "",
      });
    },
    { noteId, content },
  );
}

test("ticking a task in the Tasks tab syncs the checked state into the source note", async ({
  page,
}) => {
  const TASK_ID = "sync-task-001";
  const NOTE_ID = "test-note-1";

  // Seed the note content with a taskItem that has a stable task_id attribute
  const noteContent = {
    type: "doc",
    content: [
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: false, task_id: TASK_ID, dueDate: null },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Sync me please" }],
              },
            ],
          },
        ],
      },
    ],
  };
  await setNoteContent(page, NOTE_ID, noteContent);

  // Seed the matching task entry
  await seedTask(page, {
    id: TASK_ID,
    note_id: NOTE_ID,
    note_title: "Test Note",
    content: "Sync me please",
    is_checked: false,
    notify_at: null,
  });

  // Open Tasks tab
  await page.getByTestId("task-overview-btn").click();
  await expect(page.getByTestId("task-overview")).toBeVisible();
  await expect(page.getByText("Sync me please")).toBeVisible();

  // Switch to "All" filter so we can see both open and completed tasks
  await page.locator('[data-testid="task-overview"] label', { hasText: "All" }).click();

  // Tick the task checkbox in the Tasks tab
  // Mantine Checkbox renders as input[type="checkbox"] inside a label
  const taskCheckbox = page
    .locator('[data-testid="task-overview"] input[type="checkbox"]')
    .first();
  await taskCheckbox.click({ force: true });

  // Navigate back to the source note using the note link (task is now in Completed state,
  // still visible under "All" filter)
  await page.getByTestId("task-note-link").first().click();
  await expect(page.locator(".tiptap")).toBeVisible();

  // The task's checkbox in the editor should now be checked because update_task_checked
  // flipped the checked attr in the note content JSON.
  const TASK_ITEM_SELECTOR =
    '[contenteditable="true"] ul[data-type="taskList"] li[data-checked="true"]';
  await expect(page.locator(TASK_ITEM_SELECTOR)).toBeVisible();
  await expect(page.locator(TASK_ITEM_SELECTOR)).toContainText("Sync me please");
});
