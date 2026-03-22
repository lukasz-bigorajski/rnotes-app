import { test, expect } from "./fixtures/tauri-mock";
import type { Page } from "@playwright/test";

// TipTap v3 task list HTML structure:
// <ul data-type="taskList">
//   <li data-checked="true|false">
//     <label contenteditable="false"><input type="checkbox"><span></span></label>
//     <div><p>Task text</p></div>
//   </li>
// </ul>

const TASK_LIST_SELECTOR = '[contenteditable="true"] ul[data-type="taskList"]';
const TASK_ITEM_SELECTOR = '[contenteditable="true"] ul[data-type="taskList"] li';
const TASK_CHECKBOX_SELECTOR =
  '[contenteditable="true"] ul[data-type="taskList"] li label input[type="checkbox"]';

async function typeInEditor(page: Page, text: string) {
  await page.locator(".tiptap").click();
  await page.keyboard.type(text);
}

async function clickTaskListButton(page: Page) {
  await page.getByTitle("Task List").click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator(".tiptap").waitFor({ state: "visible" });
});

test("task list button exists in toolbar", async ({ page }) => {
  const button = page.getByTitle("Task List");
  await expect(button).toBeVisible();
});

test("task list button inserts task list markup", async ({ page }) => {
  await typeInEditor(page, "Buy groceries");
  await clickTaskListButton(page);
  await expect(page.locator(TASK_LIST_SELECTOR)).toBeVisible();
});

test("task list item has a checkbox", async ({ page }) => {
  await typeInEditor(page, "Buy groceries");
  await clickTaskListButton(page);
  const checkbox = page.locator(TASK_CHECKBOX_SELECTOR);
  await expect(checkbox).toBeVisible();
});

test("new task item starts unchecked", async ({ page }) => {
  await typeInEditor(page, "Buy groceries");
  await clickTaskListButton(page);
  const taskItem = page.locator(TASK_ITEM_SELECTOR);
  await expect(taskItem).toHaveAttribute("data-checked", "false");
});

test("clicking checkbox sets data-checked to true", async ({ page }) => {
  await typeInEditor(page, "Buy groceries");
  await clickTaskListButton(page);

  const taskItem = page.locator(TASK_ITEM_SELECTOR);
  const checkbox = page.locator(TASK_CHECKBOX_SELECTOR);

  await expect(taskItem).toHaveAttribute("data-checked", "false");
  await checkbox.click();
  await expect(taskItem).toHaveAttribute("data-checked", "true");
});

test("checked items have line-through styling", async ({ page }) => {
  await typeInEditor(page, "Buy groceries");
  await clickTaskListButton(page);

  const taskItem = page.locator(TASK_ITEM_SELECTOR);
  const checkbox = page.locator(TASK_CHECKBOX_SELECTOR);
  await checkbox.click();
  await expect(taskItem).toHaveAttribute("data-checked", "true");

  // The div inside the checked task item should have line-through styling
  const taskContent = taskItem.locator("div").first();
  await expect(taskContent).toHaveCSS("text-decoration-line", "line-through");
});

test("Enter key creates a new task item", async ({ page }) => {
  await typeInEditor(page, "First task");
  await clickTaskListButton(page);

  // Wait for task list to appear before pressing Enter
  await expect(page.locator(TASK_LIST_SELECTOR)).toBeVisible();

  // Click inside the task item content to ensure cursor is positioned inside
  await page.locator('[contenteditable="true"] ul[data-type="taskList"] li div').first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second task");

  const taskItems = page.locator(TASK_ITEM_SELECTOR);
  await expect(taskItems).toHaveCount(2);
});

test("task list button shows filled variant when inside task list", async ({ page }) => {
  await typeInEditor(page, "My task");
  await clickTaskListButton(page);

  // Click inside the task list content div to position cursor there
  await page.locator('[contenteditable="true"] ul[data-type="taskList"] li div').first().click();

  const button = page.getByTitle("Task List");
  await expect(button).toHaveAttribute("data-variant", "filled");
});

test("task list can be toggled back to paragraph", async ({ page }) => {
  await typeInEditor(page, "My task");
  await clickTaskListButton(page);

  // Verify task list is active
  await expect(page.locator(TASK_LIST_SELECTOR)).toBeVisible();

  // Toggle off
  await clickTaskListButton(page);
  await expect(page.locator(TASK_LIST_SELECTOR)).not.toBeVisible();
});

test("task list content text is visible", async ({ page }) => {
  await typeInEditor(page, "Remember to do this");
  await clickTaskListButton(page);

  const taskItem = page.locator(TASK_ITEM_SELECTOR);
  await expect(taskItem).toContainText("Remember to do this");
});
