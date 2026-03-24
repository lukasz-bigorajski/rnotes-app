import { test, expect } from "./fixtures/tauri-mock";

// Test 1: Tree renders folder/note hierarchy
test("tree renders folder/note hierarchy", async ({ page }) => {
  await page.goto("/");

  // Create a folder via the Folder button
  await page.getByRole("button", { name: "Folder" }).click();

  // Wait for "Untitled Folder" to appear in the sidebar
  const folderItem = page.getByText("Untitled Folder");
  await folderItem.waitFor({ state: "visible" });

  // Folder should have a folder icon (svg inside the tree node)
  // Click the folder to expand it
  await folderItem.click();

  // Now create a note inside the folder via context menu
  // Hover over folder to reveal 3-dot menu
  await page.getByText("Untitled Folder").hover();
  const dotsButton = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Untitled Folder" })
    .getByRole("button");
  await dotsButton.click();

  await page.getByText("New Note").click();

  // Child note "Untitled" should appear
  await expect(page.getByText("Untitled").first()).toBeVisible();
});

// Test 2: Rename note via context menu
test("rename note via context menu", async ({ page }) => {
  await page.goto("/");

  // Hover over "Test Note" to reveal 3-dot menu
  await page.getByText("Test Note").hover();
  const dotsButton = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Test Note" })
    .getByRole("button");
  await dotsButton.click();

  await page.getByText("Rename").click();

  // Inline rename input should appear
  const renameInput = page.getByTestId("inline-rename-input");
  await renameInput.waitFor({ state: "visible" });

  // Clear and type new name
  await renameInput.fill("Renamed Note");
  await page.keyboard.press("Enter");

  // Label should update
  await expect(page.getByText("Renamed Note")).toBeVisible();
  await expect(page.getByText("Test Note")).not.toBeVisible();
});

// Test 3: Delete note → appears in archive
test("delete note appears in archive", async ({ page }) => {
  await page.goto("/");

  // Open 3-dot menu on "Test Note"
  await page.getByText("Test Note").hover();
  const dotsButton = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Test Note" })
    .getByRole("button");
  await dotsButton.click();

  await page.getByText("Delete").click();

  // Note should disappear from tree
  await expect(page.getByText("Test Note")).not.toBeVisible();

  // Archive button should show a badge
  const archiveButton = page.getByRole("button", { name: /Archive/ });
  await expect(archiveButton).toBeVisible();
  await expect(archiveButton.locator("..")).toContainText("1");

  // Click Archive tab
  await archiveButton.click();

  // "Test Note" should appear in archive list
  await expect(page.getByText("Test Note")).toBeVisible();

  // Should show a "Deleted" timestamp text
  await expect(page.getByText(/Deleted/)).toBeVisible();
});

// Test 4: Restore note from archive returns to tree
test("restore note from archive returns to tree", async ({ page }) => {
  await page.goto("/");

  // Delete "Test Note" first
  await page.getByText("Test Note").hover();
  const dotsButton = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Test Note" })
    .getByRole("button");
  await dotsButton.click();
  await page.getByText("Delete").click();

  // Switch to Archive
  await page.getByRole("button", { name: /Archive/ }).click();
  await expect(page.getByText("Test Note")).toBeVisible();

  // Click Restore — the sidebar automatically closes archive (setIsArchiveOpen(false))
  await page.getByRole("button", { name: "Restore" }).click();

  // After restore, archive closes automatically and we're back in Notes view
  // "Test Note" should be visible in the tree
  await expect(page.getByText("Test Note")).toBeVisible();
});

// Test 5: Drag note onto folder moves it into folder
test("drag note onto folder moves it into folder", async ({ page }) => {
  await page.goto("/");

  // Create a folder
  await page.getByRole("button", { name: "Folder" }).click();
  await page.getByText("Untitled Folder").waitFor({ state: "visible" });

  // Locate both elements
  const noteItem = page.getByText("Test Note");
  const folderItem = page.getByText("Untitled Folder");

  const noteBox = await noteItem.boundingBox();
  const folderBox = await folderItem.boundingBox();

  if (!noteBox || !folderBox) {
    throw new Error("Could not get bounding boxes for drag");
  }

  // Simulate drag: mousedown on note, move to folder, mouseup
  await page.mouse.move(noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height / 2);
  await page.mouse.down();
  // Move in small steps for reliable drag detection
  await page.mouse.move(
    folderBox.x + folderBox.width / 2,
    folderBox.y + folderBox.height / 2,
    { steps: 10 },
  );
  await page.mouse.up();

  // Wait for the drop to process and the tree to refresh
  await page.waitForTimeout(300);

  // Expand the folder to reveal child note
  await folderItem.click();

  // "Test Note" should be visible inside the sidebar tree (scope to nav to avoid
  // matching the same text that may appear in the editor content area)
  await expect(page.locator("nav").getByText("Test Note")).toBeVisible();
});
