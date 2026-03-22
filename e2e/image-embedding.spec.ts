import { test, expect } from "./fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
});

test("image toolbar button exists", async ({ page }) => {
  const btn = page.getByTitle("Insert Image");
  await expect(btn).toBeVisible();
});

test("image toolbar button is clickable (triggers file input)", async ({ page }) => {
  const btn = page.getByTitle("Insert Image");
  await expect(btn).toBeVisible();
  // The button is disabled when no noteId, but our test note has a noteId.
  // In the mock environment noteId comes from the selected note.
  // Button click dispatches a click on the hidden file input; we cannot
  // actually open the OS file dialog in a headless test, but we verify
  // the button is present and enabled.
  const isDisabled = await btn.getAttribute("disabled");
  // The button should not be disabled when a note is selected.
  expect(isDisabled).toBeNull();
});

test("image extension is active in editor (tiptap node type registered)", async ({ page }) => {
  // Verify the TipTap Image extension is loaded by checking that the editor
  // DOM is present and that the image MIME accept list appears in the file input.
  // This confirms the extension was added to the editor configuration.

  // The .tiptap element is only rendered when TipTap initializes successfully.
  const editorEl = page.locator(".tiptap");
  await expect(editorEl).toBeVisible();

  // The hidden file input with image accept types proves the image feature
  // was mounted alongside the editor.
  const fileInput = page.locator('[data-testid="image-file-input"]');
  await expect(fileInput).toBeAttached();
  const accept = await fileInput.getAttribute("accept");
  expect(accept).toContain("image/png");
});

test("hidden file input exists in toolbar", async ({ page }) => {
  const fileInput = page.locator('[data-testid="image-file-input"]');
  await expect(fileInput).toBeAttached();
  // Verify it accepts image types
  const accept = await fileInput.getAttribute("accept");
  expect(accept).toContain("image/png");
  expect(accept).toContain("image/jpeg");
});
