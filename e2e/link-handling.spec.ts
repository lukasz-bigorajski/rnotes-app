import { test, expect } from "./fixtures/tauri-mock";
import type { Page } from "@playwright/test";

async function insertLink(page: Page, url: string, text?: string) {
  const editor = page.locator("[contenteditable]");
  await editor.click();

  if (text) {
    await page.keyboard.type(text);
    await page.keyboard.press("Meta+a");
  }

  await page.getByTitle("Link").click();

  const urlInput = page.getByPlaceholder("https://example.com").first();
  await urlInput.waitFor({ state: "visible" });
  await urlInput.fill(url);
  await page.keyboard.press("Enter");

  // Wait for link to appear
  await expect(editor.locator(`a[href="${url}"]`)).toBeVisible();
}

function getOpenedLinks(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__opened_links ?? []);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
});

test("external link click shows confirmation dialog", async ({ page }) => {
  await insertLink(page, "https://example.com", "Example");

  // Click the link
  await page.locator('[contenteditable] a[href="https://example.com"]').click();

  // Confirmation modal should appear
  const modal = page.getByText("You are about to open an external link:");
  await expect(modal).toBeVisible();
  await expect(page.getByText("https://example.com")).toBeVisible();
});

test("external link: cancel does not open", async ({ page }) => {
  await insertLink(page, "https://example.com", "Example");
  await page.locator('[contenteditable] a[href="https://example.com"]').click();

  // Wait for modal
  await expect(page.getByText("You are about to open an external link:")).toBeVisible();

  // Cancel
  await page.getByRole("button", { name: "Cancel" }).click();

  const opened = await getOpenedLinks(page);
  expect(opened).toHaveLength(0);
});

test("external link: confirm opens the link", async ({ page }) => {
  await insertLink(page, "https://example.com", "Example");
  await page.locator('[contenteditable] a[href="https://example.com"]').click();

  await expect(page.getByText("You are about to open an external link:")).toBeVisible();

  await page.getByTestId("confirm-open-link-btn").click();

  const opened = await getOpenedLinks(page);
  expect(opened).toContain("https://example.com");
});

test("external link: trust checkbox skips dialog on next click", async ({ page }) => {
  await insertLink(page, "https://example.com", "Example");

  // First click — check trust box and confirm
  await page.locator('[contenteditable] a[href="https://example.com"]').click();
  await expect(page.getByText("You are about to open an external link:")).toBeVisible();
  await page.getByTestId("trust-site-checkbox").click();
  await page.getByTestId("confirm-open-link-btn").click();

  // Second click — should open directly, no dialog
  await page.locator('[contenteditable] a[href="https://example.com"]').click();
  // Give it a moment — no modal should appear
  await page.waitForTimeout(300);
  await expect(page.getByText("You are about to open an external link:")).not.toBeVisible();

  const opened = await getOpenedLinks(page);
  expect(opened).toHaveLength(2);
});

test("external link: trust applies to same domain on different path", async ({ page }) => {
  // Trust example.com via a link
  await insertLink(page, "https://example.com/page1", "Link1");

  await page.locator('[contenteditable] a[href="https://example.com/page1"]').click();
  await expect(page.getByText("You are about to open an external link:")).toBeVisible();
  await page.getByTestId("trust-site-checkbox").click();
  await page.getByTestId("confirm-open-link-btn").click();

  // Change the link href to a different path on same domain
  // Select the link text and update its URL
  await page.keyboard.press("Meta+a");
  await page.getByTitle("Link").click();
  const urlInput = page.getByPlaceholder("https://example.com").first();
  await urlInput.waitFor({ state: "visible" });
  await urlInput.fill("https://example.com/page2");
  await page.keyboard.press("Enter");
  await expect(
    page.locator('[contenteditable] a[href="https://example.com/page2"]'),
  ).toBeVisible();

  // Click the updated link — same domain should be trusted, no dialog
  await page.locator('[contenteditable] a[href="https://example.com/page2"]').click();
  await page.waitForTimeout(300);
  await expect(page.getByText("You are about to open an external link:")).not.toBeVisible();

  const opened = await getOpenedLinks(page);
  expect(opened).toHaveLength(2);
});

test("internal note link does not show confirmation or open externally", async ({ page }) => {
  const fakeNoteId = "some-note-id-123";
  await insertLink(page, `rnotes://note/${fakeNoteId}`, "Go to note");

  // Click the internal link
  await page
    .locator(`[contenteditable] a[href="rnotes://note/${fakeNoteId}"]`)
    .click();

  // Should not show external link confirmation
  await page.waitForTimeout(300);
  await expect(page.getByText("You are about to open an external link:")).not.toBeVisible();

  // No external links should have been opened
  const opened = await getOpenedLinks(page);
  expect(opened).toHaveLength(0);
});
