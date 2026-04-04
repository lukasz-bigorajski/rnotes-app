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

/**
 * Heading shortcuts (.h1 through .h6)
 * When user types "text..h1", the paragraph converts to H1 heading
 */
test("typing text followed by ..h1 converts paragraph to H1 heading", async ({
  page,
}) => {
  await typeInEditor(page, "My Title..h1");

  // Wait for conversion
  await page.waitForTimeout(200);

  // Verify the heading exists and contains the text without the trigger
  const heading = page.locator("h1");
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText("My Title");
});

test("typing text followed by ..h2 converts paragraph to H2 heading", async ({
  page,
}) => {
  await typeInEditor(page, "Subtitle..h2");
  await page.waitForTimeout(200);

  const heading = page.locator("h2");
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText("Subtitle");
});

test("typing ..h3 alone creates empty H3 heading", async ({ page }) => {
  await typeInEditor(page, "..h3");
  await page.waitForTimeout(200);

  const heading = page.locator("h3");
  await expect(heading).toBeVisible();
});

test("all heading levels ..h1 through ..h6 work", async ({ page }) => {
  const contenteditable = page.locator("[contenteditable]");

  for (let level = 1; level <= 6; level++) {
    // Clear previous content
    await contenteditable.click();
    await page.keyboard.press("Meta+a");
    await page.keyboard.press("Delete");

    const triggerText = `Heading ${level}..h${level}`;
    await typeInEditor(page, triggerText);
    await page.waitForTimeout(200);

    const heading = page.locator(`h${level}`);
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(`Heading ${level}`);
  }
});

test("existing Cmd+Shift+1 heading shortcut still works", async ({ page }) => {
  const contenteditable = page.locator("[contenteditable]");

  // Clear previous content
  await contenteditable.click();
  await page.keyboard.press("Meta+a");
  await page.keyboard.press("Delete");

  // Type some text
  await typeInEditor(page, "Test heading");

  // Use keyboard shortcut to convert to H1
  await page.keyboard.press("Meta+Shift+!"); // Cmd+Shift+1

  // Verify it's an H1
  const heading = page.locator("h1");
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText("Test heading");
});

/**
 * Table of Contents deletion
 * Users can delete ToC by clicking X button or using Delete key
 */
test("hovering over ToC reveals delete button", async ({ page }) => {
  // Create a heading for ToC to display
  await typeInEditor(page, "# Section 1");
  await page.keyboard.press("Enter");

  // Generate ToC via toolbar
  await page.getByTitle("Generate Table of Contents").click();
  await page.waitForTimeout(300);

  // Find ToC element
  const tocElement = page.locator('[data-type="toc"]');
  await expect(tocElement).toBeVisible();

  // Hover to reveal delete button
  await tocElement.hover();

  const deleteBtn = tocElement.locator(".toc-delete-btn");
  await expect(deleteBtn).toBeVisible();
});

test("clicking ToC delete button removes the block", async ({ page }) => {
  // Create heading
  await typeInEditor(page, "# Section 1");
  await page.keyboard.press("Enter");

  // Generate ToC
  await page.getByTitle("Generate Table of Contents").click();
  await page.waitForTimeout(300);

  // Find and hover ToC to show delete button
  const tocElement = page.locator('[data-type="toc"]');
  await tocElement.hover();

  // Click delete button
  const deleteBtn = tocElement.locator(".toc-delete-btn");
  await deleteBtn.click();

  // Verify ToC is gone
  await expect(tocElement).not.toBeVisible();
});

test("selecting ToC and pressing Delete removes it", async ({ page }) => {
  // Create heading
  await typeInEditor(page, "# Section 1");
  await page.keyboard.press("Enter");

  // Generate ToC
  await page.getByTitle("Generate Table of Contents").click();
  await page.waitForTimeout(300);

  // Click on ToC to select it
  const tocElement = page.locator('[data-type="toc"]');
  await tocElement.click();

  // Press Delete
  await page.keyboard.press("Delete");

  // Verify ToC is gone
  await expect(tocElement).not.toBeVisible();
});

test("ToC can be regenerated after deletion", async ({ page }) => {
  // Create heading
  await typeInEditor(page, "# Section A");
  await page.keyboard.press("Enter");

  // Generate ToC
  await page.getByTitle("Generate Table of Contents").click();
  await page.waitForTimeout(300);

  let tocElement = page.locator('[data-type="toc"]');
  await expect(tocElement).toBeVisible();

  // Delete ToC
  await tocElement.hover();
  const deleteBtn = tocElement.locator(".toc-delete-btn");
  await deleteBtn.click();

  // Verify ToC is gone
  await expect(tocElement).not.toBeVisible();

  // Regenerate ToC
  await page.getByTitle("Generate Table of Contents").click();
  await page.waitForTimeout(300);

  // Verify new ToC appears
  tocElement = page.locator('[data-type="toc"]');
  await expect(tocElement).toBeVisible();
});
