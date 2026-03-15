import { test, expect } from "./fixtures/tauri-mock";

// Helper: locate the treeNode element containing the given text
function treeNodeWithText(page: import("@playwright/test").Page, text: string) {
  return page.locator('[class*="treeNode"]').filter({ hasText: text });
}

// Test 1: Collapsed folder with children shows the child indicator dot
test("collapsed folder with children shows child indicator", async ({ page }) => {
  await page.goto("/");

  // Create a folder
  await page.getByRole("button", { name: "Folder" }).click();
  const folderItem = page.getByText("Untitled Folder");
  await folderItem.waitFor({ state: "visible" });

  // Create a note inside the folder via context menu
  await folderItem.hover();
  const dotsButton = treeNodeWithText(page, "Untitled Folder").getByRole("button");
  await dotsButton.click();
  await page.getByText("New Note").click();

  // Child note should appear (folder auto-expands after child creation)
  await expect(page.getByText("Untitled").first()).toBeVisible();

  // Collapse the folder by clicking it
  await folderItem.click();

  // The child note should no longer be visible (folder is collapsed)
  // Note: "Untitled" text might still be in the DOM for the folder if tree hides it
  // We verify by checking the folder node has the child indicator span
  const folderNode = treeNodeWithText(page, "Untitled Folder");
  const indicator = folderNode.locator('[aria-label="has children"]');
  await expect(indicator).toBeVisible();
});

// Test 2: Empty (newly created) folder does NOT show child indicator
test("empty folder does not show child indicator", async ({ page }) => {
  await page.goto("/");

  // Create a folder — it starts empty
  await page.getByRole("button", { name: "Folder" }).click();
  const folderItem = page.getByText("Untitled Folder");
  await folderItem.waitFor({ state: "visible" });

  // Folder should not have the indicator since it's empty
  const folderNode = treeNodeWithText(page, "Untitled Folder");
  const indicator = folderNode.locator('[aria-label="has children"]');
  await expect(indicator).not.toBeVisible();
});

// Test 3: Child indicator disappears after folder is expanded
test("child indicator is hidden when folder is expanded", async ({ page }) => {
  await page.goto("/");

  // Create a folder and add a note to it
  await page.getByRole("button", { name: "Folder" }).click();
  const folderItem = page.getByText("Untitled Folder");
  await folderItem.waitFor({ state: "visible" });

  await folderItem.hover();
  const dotsButton = treeNodeWithText(page, "Untitled Folder").getByRole("button");
  await dotsButton.click();
  await page.getByText("New Note").click();

  // Folder should be expanded now (auto-expanded after child creation) — no indicator
  const folderNode = treeNodeWithText(page, "Untitled Folder");
  const indicator = folderNode.locator('[aria-label="has children"]');
  await expect(indicator).not.toBeVisible();

  // Collapse the folder — indicator should appear
  await folderItem.click();
  await expect(indicator).toBeVisible();

  // Expand again — indicator should disappear
  await folderItem.click();
  await expect(indicator).not.toBeVisible();
});
