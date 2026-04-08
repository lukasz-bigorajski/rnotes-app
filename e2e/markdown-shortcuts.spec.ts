import { test, expect } from "./fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
  await page.locator("[contenteditable]").click();
});

test("typing > + space converts to blockquote", async ({ page }) => {
  await page.keyboard.type("> ");
  await page.keyboard.type("This is a quote");

  const blockquote = page.locator("[contenteditable] blockquote");
  await expect(blockquote).toBeVisible();
  await expect(blockquote).toContainText("This is a quote");
});

test("typing ``` + space converts to code block", async ({ page }) => {
  await page.keyboard.type("``` ");

  const codeBlock = page.locator("[contenteditable] pre code");
  await expect(codeBlock).toBeVisible();
});

test("typing backtick-wrapped text converts to inline code", async ({ page }) => {
  await page.keyboard.type("`hello`");

  const inlineCode = page.locator("[contenteditable] code");
  await expect(inlineCode).toBeVisible();
  await expect(inlineCode).toContainText("hello");
});
