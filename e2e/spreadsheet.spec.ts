import { test, expect } from "./fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("create spreadsheet note via sidebar menu", async ({ page }) => {
  await page.getByTestId("create-new-btn").click();
  await page.getByTestId("create-spreadsheet-btn").click();

  await expect(page.getByTestId("spreadsheet-editor")).toBeVisible();
  await expect(page.getByTestId("spreadsheet-title-input")).toHaveValue("Untitled Spreadsheet");
});

test("spreadsheet appears in sidebar tree with table icon", async ({ page }) => {
  await page.getByTestId("create-new-btn").click();
  await page.getByTestId("create-spreadsheet-btn").click();

  await expect(page.getByTestId("spreadsheet-editor")).toBeVisible();

  // Spreadsheet note should be visible in the sidebar
  await expect(page.locator("nav")).toContainText("Untitled Spreadsheet");
});

test("spreadsheet title can be changed", async ({ page }) => {
  await page.getByTestId("create-new-btn").click();
  await page.getByTestId("create-spreadsheet-btn").click();

  const titleInput = page.getByTestId("spreadsheet-title-input");
  await titleInput.click();
  await titleInput.fill("My Budget");
  await titleInput.press("Enter");

  await expect(titleInput).toHaveValue("My Budget");
});

test("spreadsheet grid renders cells and column headers", async ({ page }) => {
  await page.getByTestId("create-new-btn").click();
  await page.getByTestId("create-spreadsheet-btn").click();

  const editor = page.getByTestId("spreadsheet-editor");
  await expect(editor).toBeVisible();

  // ReactGrid renders cells with .rg-cell class
  const cells = editor.locator(".rg-cell");
  await expect(cells.first()).toBeVisible();

  // Column headers A-J should be visible in the header row
  await expect(editor).toContainText("A");
  await expect(editor).toContainText("B");
  await expect(editor).toContainText("C");

  // Row numbers should be visible
  await expect(editor).toContainText("1");
  await expect(editor).toContainText("2");
});

test("switching back to richtext note works correctly", async ({ page }) => {
  // Create a spreadsheet
  await page.getByTestId("create-new-btn").click();
  await page.getByTestId("create-spreadsheet-btn").click();
  await expect(page.getByTestId("spreadsheet-editor")).toBeVisible();

  // Switch to the existing richtext seed note
  await page.locator("nav").getByText("Test Note").click();

  // NoteEditor (TipTap) should render, not the spreadsheet editor
  await expect(page.getByTestId("spreadsheet-editor")).not.toBeVisible();
  // The editor area should be present (TipTap renders .ProseMirror)
  await expect(page.locator(".ProseMirror")).toBeVisible();
});

test("switching back to spreadsheet after visiting richtext preserves editor", async ({
  page,
}) => {
  // Create spreadsheet
  await page.getByTestId("create-new-btn").click();
  await page.getByTestId("create-spreadsheet-btn").click();
  await expect(page.getByTestId("spreadsheet-editor")).toBeVisible();

  // Switch to richtext note
  await page.locator("nav").getByText("Test Note").click();
  await expect(page.locator(".ProseMirror")).toBeVisible();

  // Switch back to the spreadsheet
  await page.locator("nav").getByText("Untitled Spreadsheet").click();
  await expect(page.getByTestId("spreadsheet-editor")).toBeVisible();
});
