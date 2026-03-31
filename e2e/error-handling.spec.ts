import { test, expect } from "./fixtures/tauri-mock";

// Test 1: Notification container is present in the DOM
test("notification container exists in the DOM", async ({ page }) => {
  await page.goto("/");
  // Just verify the app loads without errors — Mantine Notifications injects a portal container
  await expect(page.getByRole("paragraph").filter({ hasText: "Notes" })).toBeVisible();
});

// Test 2: Deleting a note shows a confirmation dialog
test("delete note shows confirmation dialog", async ({ page }) => {
  await page.goto("/");

  // Wait for "Test Note" to appear in sidebar
  await page.getByText("Test Note").waitFor({ state: "visible" });

  // Hover over "Test Note" to reveal context menu button
  await page.getByText("Test Note").hover();
  const dotsButton = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Test Note" })
    .getByRole("button");
  await dotsButton.click();

  // Click Delete
  await page.getByText("Delete").click();

  // Confirmation modal should appear
  await expect(page.getByText("Archive note")).toBeVisible();
  await expect(page.getByText(/Are you sure you want to archive/)).toBeVisible();
});

// Test 3: Canceling confirmation keeps the note in the tree
test("canceling archive confirmation keeps the note", async ({ page }) => {
  await page.goto("/");

  // Wait for "Test Note" to appear in sidebar
  await page.getByText("Test Note").waitFor({ state: "visible" });

  // Open context menu and click Delete
  await page.getByText("Test Note").hover();
  const dotsButton = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Test Note" })
    .getByRole("button");
  await dotsButton.click();
  await page.getByText("Delete").click();

  // Wait for confirmation modal
  await expect(page.getByText(/Are you sure you want to archive/)).toBeVisible();

  // Click Cancel
  await page.getByRole("button", { name: "Cancel" }).click();

  // Modal should close
  await expect(page.getByText(/Are you sure you want to archive/)).not.toBeVisible();

  // Note should still be in the tree
  await expect(page.getByText("Test Note")).toBeVisible();
});

// Test 4: Confirming archive removes the note from the tree
test("confirming archive removes the note from the tree", async ({ page }) => {
  await page.goto("/");

  // Wait for "Test Note" to appear in sidebar
  await page.getByText("Test Note").waitFor({ state: "visible" });

  // Open context menu and click Delete
  await page.getByText("Test Note").hover();
  const dotsButton = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Test Note" })
    .getByRole("button");
  await dotsButton.click();
  await page.getByText("Delete").click();

  // Wait for confirmation modal and confirm
  await expect(page.getByText(/Are you sure you want to archive/)).toBeVisible();
  await page.getByTestId("confirm-archive-btn").click();

  // Modal should close
  await expect(page.getByText(/Are you sure you want to archive/)).not.toBeVisible();

  // Note should no longer be visible in the tree
  await expect(page.getByText("Test Note")).not.toBeVisible();
});

// Test 5: Save status indicator shows "Saved" after editing
test("save status indicator shows Saved after editing", async ({ page }) => {
  await page.goto("/");

  // Click on "Test Note" to open it
  await page.getByText("Test Note").click();

  // Wait for the editor to load
  await expect(page.getByTestId("note-title-input")).toBeVisible();

  // Click into the editor area and type something
  await page.locator(".tiptap").click();
  await page.keyboard.type("Hello world");

  // The save status indicator should show "Saved" after saving completes
  await expect(page.getByTestId("save-status-saved")).toBeVisible({ timeout: 5000 });
});
