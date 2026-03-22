import { test, expect } from "./fixtures/tauri-mock";
import type { Page } from "@playwright/test";

// Task due date UI tests — validates the TaskItemView NodeView rendering.
// Notification testing requires a real Tauri runtime and is not covered here.

const TASK_ITEM_SELECTOR = '[contenteditable="true"] ul[data-type="taskList"] li';

async function typeInEditor(page: Page, text: string) {
  await page.locator(".tiptap").click();
  await page.keyboard.type(text);
}

async function clickTaskListButton(page: Page) {
  await page.getByTitle("Task List").click();
}

async function createTaskItem(page: Page, text: string) {
  await typeInEditor(page, text);
  await clickTaskListButton(page);
  await expect(page.locator(TASK_ITEM_SELECTOR)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator(".tiptap").waitFor({ state: "visible" });
});

test("task item shows calendar icon button", async ({ page }) => {
  await createTaskItem(page, "My task");

  // Hover over the task item to reveal the calendar button
  const taskItem = page.locator(TASK_ITEM_SELECTOR).first();
  await taskItem.hover();

  const calendarBtn = page.locator('[data-testid="task-calendar-btn"]').first();
  await expect(calendarBtn).toBeVisible();
});

test("clicking calendar icon opens a popover", async ({ page }) => {
  await createTaskItem(page, "My task with date");

  const taskItem = page.locator(TASK_ITEM_SELECTOR).first();
  await taskItem.hover();

  const calendarBtn = page.locator('[data-testid="task-calendar-btn"]').first();
  await calendarBtn.click();

  // DateTimePicker should appear in a popover
  const datePicker = page.locator('[data-testid="task-date-picker"]');
  await expect(datePicker).toBeVisible();
});

test("task due date controls container is present on task item", async ({ page }) => {
  await createTaskItem(page, "Reminder task");

  const dueControls = page.locator('[data-testid="task-due-controls"]').first();
  await expect(dueControls).toBeAttached();
});

test("no due date badge shown by default", async ({ page }) => {
  await createTaskItem(page, "No due date task");

  const badge = page.locator('[data-testid="task-due-badge"]').first();
  await expect(badge).not.toBeVisible();
});
