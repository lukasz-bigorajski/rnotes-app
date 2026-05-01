import { test, expect } from "./fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

// Help button in sidebar opens the dialog (UI button approach)
test("help button in sidebar opens keyboard shortcuts dialog", async ({ page }) => {
  await page.getByTestId("open-shortcuts-btn").click();
  const dialog = page.getByTestId("keyboard-shortcuts-dialog");
  await expect(dialog).toBeVisible();
});

// Escape closes the help dialog
test("Escape closes the keyboard shortcuts help dialog", async ({ page }) => {
  await page.getByTestId("open-shortcuts-btn").click();
  const dialog = page.getByTestId("keyboard-shortcuts-dialog");
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

// The help dialog lists expected shortcut categories
test("keyboard shortcuts dialog shows all expected groups", async ({ page }) => {
  await page.getByTestId("open-shortcuts-btn").click();
  const dialog = page.getByTestId("keyboard-shortcuts-dialog");
  await expect(dialog).toBeVisible();

  await expect(page.getByTestId("shortcut-group-general")).toBeVisible();
  await expect(page.getByTestId("shortcut-group-navigation")).toBeVisible();
  await expect(page.getByTestId("shortcut-group-editor-formatting")).toBeVisible();
  await expect(page.getByTestId("shortcut-group-editor-structure")).toBeVisible();
});

// Cmd+N creates a new note (via keyboard shortcut)
test("Cmd+N creates a new note", async ({ page }) => {
  // Count notes with text "Untitled" visible in the sidebar before
  const notesBefore = await page.locator("nav").getByText("Untitled").count();

  await page.keyboard.press("Meta+n");

  // Note is auto-placed in rename mode; click input to ensure focus (editor may steal it),
  // then dismiss with Escape to show the text label
  const renameInput = page.getByTestId("inline-rename-input");
  await renameInput.waitFor({ state: "visible" });
  await renameInput.click();
  await page.keyboard.press("Escape");

  // A new "Untitled" note should appear in the sidebar
  await expect(page.locator("nav")).toContainText("Untitled");
  const notesAfter = await page.locator("nav").getByText("Untitled").count();
  expect(notesAfter).toBeGreaterThan(notesBefore);
});

// Cmd+Shift+T switches to task overview
test("Cmd+Shift+T switches to task overview", async ({ page }) => {
  await page.keyboard.press("Meta+Shift+T");
  const overview = page.getByTestId("task-overview");
  await expect(overview).toBeVisible();
});

// Cmd+\ toggles sidebar visibility
test("Cmd+\\ toggles sidebar visibility", async ({ page }) => {
  // Sidebar should be visible initially
  await expect(page.locator("nav")).toBeVisible();

  await page.keyboard.press("Meta+\\");

  // Sidebar should be hidden
  await expect(page.locator("nav")).not.toBeVisible();

  // Toggle back
  await page.keyboard.press("Meta+\\");
  await expect(page.locator("nav")).toBeVisible();
});
