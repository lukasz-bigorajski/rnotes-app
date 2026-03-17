import { test, expect } from "./fixtures/tauri-mock";

test.describe("Editable note title", () => {
  test("title field is visible when a note is selected", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Test Note").click();
    const titleInput = page.getByTestId("note-title-input");
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue("Test Note");
  });

  test("new note auto-focuses title with Untitled selected", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Note", exact: true }).click();

    const titleInput = page.getByTestId("note-title-input");
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toBeFocused();

    // The selection should cover "Untitled" — typing replaces it
    await page.keyboard.type("My New Title");
    await expect(titleInput).toHaveValue("My New Title");
  });

  test("editing title updates sidebar after blur", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Test Note").click();

    const titleInput = page.getByTestId("note-title-input");
    await titleInput.clear();
    await titleInput.fill("Renamed Title");
    // Blur to trigger save
    await page.locator("[contenteditable]").click();

    // Sidebar should eventually show the new title
    await expect(page.getByText("Renamed Title")).toBeVisible();
  });
});

test.describe("Sticky toolbar", () => {
  test("toolbar stays visible when scrolled to bottom of long note", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Test Note").click();
    await page.locator("[contenteditable]").waitFor({ state: "visible" });

    // Type enough content to make the page scrollable
    await page.locator("[contenteditable]").click();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.type(`Line ${i + 1} of content for scroll test`);
      await page.keyboard.press("Enter");
    }

    // Scroll to the bottom of the editor wrapper
    await page.evaluate(() => {
      const wrapper = document.querySelector('[class*="editorWrapper"]');
      if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
    });

    // The toolbar should still be visible (sticky) — check a toolbar button is in viewport
    const boldButton = page.getByTitle("Bold");
    await expect(boldButton).toBeInViewport();
  });
});

test.describe("Code block button", () => {
  test("code block button exists next to blockquote button", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Test Note").click();
    await page.locator("[contenteditable]").waitFor({ state: "visible" });

    const blockquoteBtn = page.getByTitle("Blockquote");
    const codeBlockBtn = page.getByTitle("Code Block");
    await expect(blockquoteBtn).toBeVisible();
    await expect(codeBlockBtn).toBeVisible();
  });

  test("code block button toggles code block", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Test Note").click();
    await page.locator("[contenteditable]").click();
    await page.keyboard.type("some code here");

    const codeBlockBtn = page.getByTitle("Code Block");
    await codeBlockBtn.click();
    await expect(page.locator("[contenteditable] pre")).toBeVisible();
  });
});

test.describe("Blockquote and code block visual styling", () => {
  test("blockquote has left border styling", async ({ page }) => {
    await page.goto("/");
    // Ensure light color scheme CSS variables are active
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-mantine-color-scheme", "light");
    });
    await page.getByText("Test Note").click();
    await page.locator("[contenteditable]").click();
    await page.keyboard.type("quoted text");
    await page.keyboard.press("Meta+a");
    await page.getByTitle("Blockquote").click();

    const blockquote = page.locator("[contenteditable] blockquote");
    await expect(blockquote).toBeVisible();
    const borderLeft = await blockquote.evaluate(
      (el) => window.getComputedStyle(el).borderLeftWidth,
    );
    // Should have a non-zero left border
    expect(parseInt(borderLeft)).toBeGreaterThan(0);
  });

  test("code block has distinct background", async ({ page }) => {
    await page.goto("/");
    // Ensure light color scheme CSS variables are active
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-mantine-color-scheme", "light");
    });
    await page.getByText("Test Note").click();
    await page.locator("[contenteditable]").click();
    await page.keyboard.type("const x = 1;");
    await page.getByTitle("Code Block").click();

    const pre = page.locator("[contenteditable] pre");
    await expect(pre).toBeVisible();
    const bg = await pre.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    // Should not be transparent/white — has a dark or distinct background
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");
  });
});
