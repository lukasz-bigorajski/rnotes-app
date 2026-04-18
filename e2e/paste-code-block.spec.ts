import { test, expect } from "./fixtures/tauri-mock";
import type { Page } from "@playwright/test";

async function pasteTextIntoEditor(page: Page, text: string) {
  await page.evaluate((pasteText) => {
    const editor = document.querySelector(".ProseMirror");
    if (!editor) throw new Error("Editor not found");
    const dt = new DataTransfer();
    dt.setData("text/plain", pasteText);
    const event = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true });
    editor.dispatchEvent(event);
  }, text);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
});

test("multi-line paste inside code block keeps all lines in the block", async ({ page }) => {
  const editor = page.locator("[contenteditable]");
  await editor.click();

  await page.getByTitle("Code Block").click();
  await page.locator("[contenteditable] pre").waitFor({ state: "visible" });
  await page.locator("[contenteditable] pre").click();

  const fiveLines = "line1\nline2\nline3\nline4\nline5";
  await pasteTextIntoEditor(page, fiveLines);
  await page.waitForTimeout(200);

  const pre = page.locator("[contenteditable] pre");
  await expect(pre).toContainText("line1");
  await expect(pre).toContainText("line5");

  const preText = await pre.innerText();
  expect(preText).toContain("line1");
  expect(preText).toContain("line2");
  expect(preText).toContain("line3");
  expect(preText).toContain("line4");
  expect(preText).toContain("line5");

  const paragraphsWithContent = await page.locator("[contenteditable] > p:not(:has(.ProseMirror-trailingBreak))").count();
  expect(paragraphsWithContent).toBe(0);
});

test("markdown-looking paste inside code block stays as plain text in the block", async ({
  page,
}) => {
  const editor = page.locator("[contenteditable]");
  await editor.click();

  await page.getByTitle("Code Block").click();
  await page.locator("[contenteditable] pre").waitFor({ state: "visible" });
  await page.locator("[contenteditable] pre").click();

  const markdownLike = "- a\n- b\n- c";
  await pasteTextIntoEditor(page, markdownLike);
  await page.waitForTimeout(200);

  const pre = page.locator("[contenteditable] pre");
  await expect(pre).toContainText("- a");
  await expect(pre).toContainText("- b");
  await expect(pre).toContainText("- c");

  const listItems = await page.locator("[contenteditable] li").count();
  expect(listItems).toBe(0);

  const paragraphsWithContent = await page.locator("[contenteditable] > p:not(:has(.ProseMirror-trailingBreak))").count();
  expect(paragraphsWithContent).toBe(0);
});
