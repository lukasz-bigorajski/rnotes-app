import { test, expect } from "./fixtures/tauri-mock";

// Helper to seed a task via the mock's add_mock_task command
async function seedTask(
  page: import("@playwright/test").Page,
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

test("clicking a note in the sidebar switches back to editor view", async ({ page }) => {
  await page.getByTestId("task-overview-btn").click();
  await expect(page.getByTestId("task-overview")).toBeVisible();

  // Click a note in the sidebar
  await page.getByText("Test Note").click();

  // Editor should be visible, task overview should not
  await expect(page.locator(".tiptap")).toBeVisible();
  await expect(page.getByTestId("task-overview")).not.toBeVisible();
});
