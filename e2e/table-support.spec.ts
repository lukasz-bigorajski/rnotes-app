import { test, expect } from "./fixtures/tauri-mock";
import type { Page } from "@playwright/test";

async function typeInEditor(page: Page, text: string) {
  await page.locator("[contenteditable]").click();
  await page.keyboard.type(text);
}

async function insertTable(page: Page) {
  await page.getByTestId("table-menu-button").click();
  await page.getByTestId("insert-table-item").click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
});

test.describe("Table support", () => {
  test("table button exists in toolbar", async ({ page }) => {
    const tableBtn = page.getByTestId("table-menu-button");
    await expect(tableBtn).toBeVisible();
  });

  test("insert table creates a table element in the editor", async ({ page }) => {
    await page.locator("[contenteditable]").click();
    await insertTable(page);
    const table = page.locator("[contenteditable] table");
    await expect(table).toBeVisible();
  });

  test("inserted table has a header row with th elements", async ({ page }) => {
    await page.locator("[contenteditable]").click();
    await insertTable(page);
    const headerCells = page.locator("[contenteditable] table th");
    await expect(headerCells).toHaveCount(3);
  });

  test("type text in a table cell", async ({ page }) => {
    await page.locator("[contenteditable]").click();
    await insertTable(page);
    // Click the first body cell (td) and type
    const firstCell = page.locator("[contenteditable] table td").first();
    await firstCell.click();
    await page.keyboard.type("Hello Table");
    await expect(firstCell).toHaveText("Hello Table");
  });

  test("add row after increases row count", async ({ page }) => {
    await page.locator("[contenteditable]").click();
    await insertTable(page);

    // Initial rows: 1 header + 2 body rows = 3 total
    const rowsBefore = await page.locator("[contenteditable] table tr").count();

    // Click a body cell to position cursor inside the table
    await page.locator("[contenteditable] table td").first().click();

    // Open menu and add row after
    await page.getByTestId("table-menu-button").click();
    await page.getByTestId("add-row-after-item").click();

    const rowsAfter = await page.locator("[contenteditable] table tr").count();
    expect(rowsAfter).toBe(rowsBefore + 1);
  });

  test("delete table removes the table from the editor", async ({ page }) => {
    await page.locator("[contenteditable]").click();
    await insertTable(page);
    await expect(page.locator("[contenteditable] table")).toBeVisible();

    // Click a cell to position cursor inside the table
    await page.locator("[contenteditable] table td").first().click();

    // Open menu and delete table
    await page.getByTestId("table-menu-button").click();
    await page.getByTestId("delete-table-item").click();

    await expect(page.locator("[contenteditable] table")).not.toBeVisible();
  });

  test("add/delete row menu items are disabled when cursor is outside a table", async ({ page }) => {
    // Type regular text (cursor is in a paragraph, not a table)
    await typeInEditor(page, "regular text");

    await page.getByTestId("table-menu-button").click();

    const addRowAfter = page.getByTestId("add-row-after-item");
    const deleteRow = page.getByTestId("delete-row-item");

    await expect(addRowAfter).toHaveAttribute("data-disabled", "true");
    await expect(deleteRow).toHaveAttribute("data-disabled", "true");
  });
});
