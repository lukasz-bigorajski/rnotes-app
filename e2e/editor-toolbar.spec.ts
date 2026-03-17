import { test, expect } from "./fixtures/tauri-mock";
import type { Page } from "@playwright/test";

async function typeInEditor(page: Page, text: string) {
  await page.locator("[contenteditable]").click();
  await page.keyboard.type(text);
}

async function selectAllEditorText(page: Page) {
  await page.locator("[contenteditable]").click();
  await page.keyboard.press("Meta+a");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
});

test("editor renders with placeholder", async ({ page }) => {
  const editor = page.locator("[contenteditable]");
  // TipTap adds a placeholder class when the editor is empty
  await expect(editor).toHaveAttribute("contenteditable", "true");
  // The placeholder "Start writing…" is rendered via CSS ::before,
  // so we check for the placeholder node or the data attribute
  const placeholder = page.locator(".tiptap p.is-editor-empty");
  await expect(placeholder).toBeVisible();
});

test("bold toggle", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Bold").click();
  await expect(page.locator("[contenteditable] strong")).toHaveText(
    "hello world",
  );
});

test("italic toggle", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Italic").click();
  await expect(page.locator("[contenteditable] em")).toHaveText("hello world");
});

test("strikethrough toggle", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Strikethrough").click();
  await expect(page.locator("[contenteditable] s")).toHaveText("hello world");
});

test("code toggle", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Code", { exact: true }).click();
  await expect(page.locator("[contenteditable] code")).toHaveText(
    "hello world",
  );
});

test("heading 1", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Heading 1").click();
  await expect(page.locator("[contenteditable] h1")).toHaveText("hello world");
});

test("heading 2", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Heading 2").click();
  await expect(page.locator("[contenteditable] h2")).toHaveText("hello world");
});

test("heading 3", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Heading 3").click();
  await expect(page.locator("[contenteditable] h3")).toHaveText("hello world");
});

test("bullet list", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Bullet List").click();
  await expect(page.locator("[contenteditable] ul")).toBeVisible();
});

test("ordered list", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Ordered List").click();
  await expect(page.locator("[contenteditable] ol")).toBeVisible();
});

test("blockquote", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Blockquote").click();
  await expect(page.locator("[contenteditable] blockquote")).toBeVisible();
});

test("link popover", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Link").click();
  const urlInput = page.getByPlaceholder("https://example.com");
  await urlInput.waitFor({ state: "visible" });
  await urlInput.fill("https://test.com");
  await page.keyboard.press("Enter");
  const link = page.locator('[contenteditable] a[href="https://test.com"]');
  await expect(link).toBeVisible();
});

test("undo and redo", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await expect(page.locator("[contenteditable]")).toContainText("hello world");
  await page.keyboard.press("Meta+z");
  await expect(page.locator("[contenteditable]")).not.toContainText(
    "hello world",
  );
  await page.keyboard.press("Meta+Shift+z");
  await expect(page.locator("[contenteditable]")).toContainText("hello world");
});

test("active state on bold button", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Bold").click();
  // Place cursor inside the bold text
  await page.locator("[contenteditable] strong").click();
  await expect(page.getByTitle("Bold")).toHaveAttribute(
    "data-variant",
    "filled",
  );
});
