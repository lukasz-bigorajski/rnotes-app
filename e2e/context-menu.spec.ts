import { test, expect } from "./fixtures/tauri-mock";

test.use({
  launchOptions: {
    args: ["--enable-features=UnsafeWebGPU"],
  },
});

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
});

test("Copy raw: copies plain text without markdown syntax", async ({ page }) => {
  const editor = page.locator("[contenteditable]");
  await editor.click();

  // Type bold text via markdown shortcut (tiptap-markdown parses **bold**)
  // We'll type plain text then use execCommand bold to get a bold mark
  await page.keyboard.type("Hello world");

  // Select "Hello world"
  await page.keyboard.press("Meta+a");
  await page.waitForTimeout(100);

  // Make it bold
  await page.keyboard.press("Meta+b");
  await page.waitForTimeout(100);

  // Select all to get the bold text selected
  await page.keyboard.press("Meta+a");
  await page.waitForTimeout(100);

  // Right-click to open context menu
  await editor.click({ button: "right" });
  await page.waitForTimeout(200);

  // Click "Copy raw"
  await page.getByText("Copy raw").click();
  await page.waitForTimeout(200);

  // Read clipboard
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe("Hello world");
  // Must not contain markdown bold markers
  expect(clipboardText).not.toContain("**");
});

test("Copy as Markdown: copies selected text as markdown", async ({ page }) => {
  const editor = page.locator("[contenteditable]");
  await editor.click();

  // Type text and make it bold
  await page.keyboard.type("bold text");
  await page.keyboard.press("Meta+a");
  await page.waitForTimeout(100);
  await page.keyboard.press("Meta+b");
  await page.waitForTimeout(100);

  // Select all
  await page.keyboard.press("Meta+a");
  await page.waitForTimeout(100);

  // Right-click to open context menu
  await editor.click({ button: "right" });
  await page.waitForTimeout(200);

  // Click "Copy as Markdown"
  await page.getByText("Copy as Markdown").click();
  await page.waitForTimeout(200);

  // Read clipboard — should contain markdown bold syntax
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain("bold text");
  expect(clipboardText).toContain("**");
});

test("context menu shows all expected items", async ({ page }) => {
  const editor = page.locator("[contenteditable]");
  await editor.click();
  await page.keyboard.type("Some text");
  await page.waitForTimeout(100);

  // Right-click to open context menu
  await editor.click({ button: "right" });
  await page.waitForTimeout(200);

  const menu = page.locator(".custom-context-menu");
  await expect(menu).toBeVisible();

  // Verify all expected menu items are present
  await expect(page.getByRole("button", { name: "Cut", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy raw", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy as Markdown", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Paste", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Paste raw", exact: true })).toBeVisible();

  // "Paste as plain text" label should no longer exist
  await expect(page.getByRole("button", { name: "Paste as plain text", exact: true })).not.toBeVisible();
});

test("context menu closes on Escape", async ({ page }) => {
  const editor = page.locator("[contenteditable]");
  await editor.click();

  await editor.click({ button: "right" });
  await page.waitForTimeout(200);

  const menu = page.locator(".custom-context-menu");
  await expect(menu).toBeVisible();

  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);

  await expect(menu).not.toBeVisible();
});

test("context menu closes on click outside", async ({ page }) => {
  const editor = page.locator("[contenteditable]");
  await editor.click();

  await editor.click({ button: "right" });
  await page.waitForTimeout(200);

  const menu = page.locator(".custom-context-menu");
  await expect(menu).toBeVisible();

  // Click outside the menu
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(100);

  await expect(menu).not.toBeVisible();
});
