import { test, expect } from "./fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
});

test.describe("Table context menu (BubbleMenu)", () => {
  test("context menu appears when cursor is inside a table", async ({ page }) => {
    // Insert a table using the toolbar
    await page.getByTestId("table-menu-button").click();
    await page.getByTestId("insert-table-item").click();
    await page.waitForTimeout(300);

    // Click inside the table to activate BubbleMenu
    await page.locator("[contenteditable] table td").first().click();

    // The context menu button should be visible via the BubbleMenu
    const menuButton = page.locator('[title="Table Options"]');
    await expect(menuButton).toBeVisible();
  });

  test("context menu does not appear when cursor is outside a table", async ({ page }) => {
    await page.locator("[contenteditable]").click();
    await page.keyboard.type("Some text");

    // Table context menu button should not be visible when outside a table
    const menuButton = page.locator('[title="Table Options"]');
    await expect(menuButton).not.toBeVisible();
  });

  test("BubbleMenu table options work: add row above", async ({ page }) => {
    // Insert table
    await page.getByTestId("table-menu-button").click();
    await page.getByTestId("insert-table-item").click();
    await page.waitForTimeout(300);

    const rowsBefore = await page.locator("[contenteditable] table tr").count();

    // Click inside table and open BubbleMenu
    await page.locator("[contenteditable] table td").first().click();
    const menuButton = page.locator('[title="Table Options"]');
    await menuButton.click();

    // Use BubbleMenu option
    await page.getByTestId("table-menu-add-row-before").click();

    const rowsAfter = await page.locator("[contenteditable] table tr").count();
    expect(rowsAfter).toBe(rowsBefore + 1);
  });

  test("BubbleMenu table options work: delete table", async ({ page }) => {
    // Insert table
    await page.getByTestId("table-menu-button").click();
    await page.getByTestId("insert-table-item").click();
    await page.waitForTimeout(300);

    const table = page.locator("[contenteditable] table");
    await expect(table).toBeVisible();

    // Click inside table and open BubbleMenu
    await page.locator("[contenteditable] table td").first().click();
    const menuButton = page.locator('[title="Table Options"]');
    await menuButton.click();

    // Delete table via BubbleMenu
    await page.getByTestId("table-menu-delete-table").click();

    // Table should be gone
    await expect(table).not.toBeVisible();
  });

  test("BubbleMenu closes when cursor leaves table", async ({ page }) => {
    // Type some text above the table first
    await page.locator("[contenteditable]").click();
    await page.keyboard.type("Text before table");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");

    // Insert table
    await page.getByTestId("table-menu-button").click();
    await page.getByTestId("insert-table-item").click();
    await page.waitForTimeout(300);

    // Click inside table - menu should appear
    await page.locator("[contenteditable] table td").first().click();
    const menuButton = page.locator('[title="Table Options"]');
    await expect(menuButton).toBeVisible();

    // Move cursor outside the table by clicking on the text above
    await page.locator("[contenteditable] p").first().click();
    await page.waitForTimeout(200);

    // Menu should not be visible
    await expect(menuButton).not.toBeVisible();
  });
});
