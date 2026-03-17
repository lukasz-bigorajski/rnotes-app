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

// ─── Table of Contents ────────────────────────────────────────────────────────

test("ToC button exists in toolbar", async ({ page }) => {
  await expect(page.getByTitle("Generate Table of Contents")).toBeVisible();
});

test("ToC: no headings shows alert", async ({ page }) => {
  await typeInEditor(page, "Just some plain text, no headings.");

  // Listen for the alert dialog
  let alertMessage = "";
  page.on("dialog", async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  await page.getByTitle("Generate Table of Contents").click();
  // Give alert time to fire
  await page.waitForTimeout(200);
  expect(alertMessage).toContain("No headings found");
});

test("ToC: inserts table of contents from headings", async ({ page }) => {
  // Use TipTap's markdown input rules: "# " at start of line creates H1
  await page.locator("[contenteditable]").click();
  await page.keyboard.type("# Introduction");
  await page.keyboard.press("Enter");
  await page.keyboard.type("## Section One");

  // Generate ToC
  await page.getByTitle("Generate Table of Contents").click();

  // Check the ToC block is present with both headings
  const toc = page.locator('[data-type="toc"]');
  await expect(toc).toBeVisible();
  await expect(toc).toContainText("Introduction");
  await expect(toc).toContainText("Section One");
});

test("ToC: replaces existing table of contents on re-generate", async ({ page }) => {
  // Add a heading using TipTap input rule
  await page.locator("[contenteditable]").click();
  await page.keyboard.type("# My Heading");

  // Generate ToC once
  await page.getByTitle("Generate Table of Contents").click();
  await expect(page.locator('[data-type="toc"]')).toBeVisible();

  // Generate ToC again — should still only have one ToC
  await page.getByTitle("Generate Table of Contents").click();
  const tocCount = await page.locator('[data-type="toc"]').count();
  expect(tocCount).toBe(1);
});

// ─── Improved Link Button ──────────────────────────────────────────────────────

test("link popover: text selected opens toolbar popover with autoFocus", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Link").click();

  const urlInput = page.getByPlaceholder("https://example.com").first();
  await urlInput.waitFor({ state: "visible" });
  await urlInput.fill("https://test.com");
  await page.keyboard.press("Enter");

  const link = page.locator('[contenteditable] a[href="https://test.com"]');
  await expect(link).toBeVisible();
});

test("link popover: escape closes without applying link", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await selectAllEditorText(page);
  await page.getByTitle("Link").click();

  const urlInput = page.getByPlaceholder("https://example.com").first();
  await urlInput.waitFor({ state: "visible" });
  await urlInput.fill("https://should-not-apply.com");
  await page.keyboard.press("Escape");

  // Popover should close
  await expect(urlInput).not.toBeVisible();
  // No link should be created
  const link = page.locator('[contenteditable] a');
  await expect(link).toHaveCount(0);
});

test("link button: no selection shows floating dialog near cursor", async ({ page }) => {
  await typeInEditor(page, "hello world");
  // Click at end of text (no selection)
  await page.locator("[contenteditable]").click();
  await page.keyboard.press("End");

  await page.getByTitle("Link").click();

  // Floating dialog should appear (not the toolbar popover)
  const floatingDialog = page.locator('[data-testid="floating-link-dialog"]');
  await expect(floatingDialog).toBeVisible();
});

test("link button: floating dialog escape closes it", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await page.locator("[contenteditable]").click();
  await page.keyboard.press("End");

  await page.getByTitle("Link").click();

  const floatingDialog = page.locator('[data-testid="floating-link-dialog"]');
  await expect(floatingDialog).toBeVisible();

  // Click the input to ensure it has focus before pressing Escape
  await floatingDialog.locator("input").click();
  await page.keyboard.press("Escape");
  await expect(floatingDialog).not.toBeVisible();
});

test("link button: floating dialog enter inserts link text", async ({ page }) => {
  await typeInEditor(page, "hello world");
  await page.locator("[contenteditable]").click();
  await page.keyboard.press("End");

  await page.getByTitle("Link").click();

  const floatingDialog = page.locator('[data-testid="floating-link-dialog"]');
  await expect(floatingDialog).toBeVisible();

  const floatingInput = floatingDialog.locator('input');
  await floatingInput.fill("https://inserted.com");
  await page.keyboard.press("Enter");

  // Dialog should close
  await expect(floatingDialog).not.toBeVisible();

  // A link should be inserted in the editor
  const link = page.locator('[contenteditable] a[href="https://inserted.com"]');
  await expect(link).toBeVisible();
});
