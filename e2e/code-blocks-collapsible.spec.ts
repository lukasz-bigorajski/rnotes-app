import { test, expect } from "./fixtures/tauri-mock";
import type { Page } from "@playwright/test";

async function typeInEditor(page: Page, text: string) {
  await page.locator("[contenteditable]").click();
  await page.keyboard.type(text);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
});

test.describe("Code Blocks with Syntax Highlighting", () => {
  test("create code block via toolbar and verify pre element", async ({ page }) => {
    await typeInEditor(page, "const x = 42;");
    await page.keyboard.press("Meta+a");
    await page.getByTitle("Code Block").click();
    const pre = page.locator("[contenteditable] pre");
    await expect(pre).toBeVisible();
    await expect(pre).toContainText("const x = 42;");
  });

  test("code block has language selector", async ({ page }) => {
    await typeInEditor(page, "hello");
    await page.keyboard.press("Meta+a");
    await page.getByTitle("Code Block").click();
    const langSelect = page.locator("[data-testid='code-block-language-select']");
    await expect(langSelect).toBeVisible();
  });

  test("change language via selector and verify attribute updates", async ({ page }) => {
    await typeInEditor(page, "print('hello')");
    await page.keyboard.press("Meta+a");
    await page.getByTitle("Code Block").click();
    const langSelect = page.locator("[data-testid='code-block-language-select']");
    await expect(langSelect).toBeVisible();
    await langSelect.selectOption("python");
    await expect(langSelect).toHaveValue("python");
  });

  test("syntax highlighting adds hljs classes to code tokens", async ({ page }) => {
    await typeInEditor(page, 'const x = "hello";');
    await page.keyboard.press("Meta+a");
    await page.getByTitle("Code Block").click();
    const langSelect = page.locator("[data-testid='code-block-language-select']");
    await langSelect.selectOption("javascript");
    // Wait for highlighting decorations — hljs classes should appear on spans
    const hljsSpan = page.locator("[contenteditable] pre .hljs-keyword");
    await expect(hljsSpan).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Collapsible Sections", () => {
  test("insert collapsible section via toolbar button", async ({ page }) => {
    await typeInEditor(page, "some text");
    await page.getByTitle("Collapsible Section").click();
    // The Details extension renders as div[data-type="details"]
    const details = page.locator('[contenteditable] [data-type="details"]');
    await expect(details).toBeVisible();
  });

  test("collapsible section has summary element", async ({ page }) => {
    await typeInEditor(page, "some text");
    await page.getByTitle("Collapsible Section").click();
    const summary = page.locator('[contenteditable] [data-type="details"] summary');
    await expect(summary).toBeVisible();
  });

  test("click toggle button to open/close content", async ({ page }) => {
    await typeInEditor(page, "some text");
    await page.getByTitle("Collapsible Section").click();
    const details = page.locator('[contenteditable] [data-type="details"]');
    await expect(details).toBeVisible();
    // Find the toggle button
    const toggleBtn = details.locator("> button");
    // Click to toggle open
    await toggleBtn.click();
    // After clicking, is-open class should be toggled
    await expect(details).toHaveClass(/is-open/);
    // Click again to close
    await toggleBtn.click();
    await expect(details).not.toHaveClass(/is-open/);
  });

  test("type text inside collapsible section content", async ({ page }) => {
    await typeInEditor(page, "some text");
    await page.getByTitle("Collapsible Section").click();
    const details = page.locator('[contenteditable] [data-type="details"]');
    await expect(details).toBeVisible();
    // Open the details content by clicking toggle
    const toggleBtn = details.locator("> button");
    await toggleBtn.click();
    // Wait for detailsContent to become visible (hidden attr removed)
    const detailsContent = page.locator('[data-type="detailsContent"]:not([hidden])');
    await expect(detailsContent).toBeVisible({ timeout: 3000 });
    // The original text "some text" should be inside the content area
    await expect(detailsContent).toContainText("some text");
  });
});
