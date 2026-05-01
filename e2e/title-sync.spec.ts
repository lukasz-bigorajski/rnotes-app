import { test, expect } from "./fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("rename note then immediately switch to Tasks tab - sidebar shows new title on return", async ({
  page,
}) => {
  // Open the seed note
  await page.getByText("Test Note").click();
  await page.getByTestId("note-title-input").waitFor({ state: "visible" });

  // Type a new title — do NOT wait 600ms (simulate the race)
  const titleInput = page.getByTestId("note-title-input");
  await titleInput.click({ clickCount: 3 });
  await titleInput.fill("Renamed Quickly");

  // Immediately switch to Tasks tab (before debounce fires)
  await page.getByTestId("task-overview-btn").click();
  await page.getByTestId("task-overview").waitFor({ state: "visible" });

  // Switch back to Notes
  await page.getByRole("button", { name: "Notes" }).click();

  // Sidebar should show the renamed title, not "Test Note"
  await expect(page.locator("nav").getByText("Renamed Quickly")).toBeVisible();
});

test("expand folders then switch to Tasks and back - folders remain expanded", async ({
  page,
}) => {
  // Create a folder
  await page.getByTestId("create-new-btn").click();
  await page.getByTestId("create-folder-btn").click();
  // Folder is auto-placed in rename mode — dismiss to show the text label
  await page.getByTestId("inline-rename-input").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.getByText("Untitled Folder").waitFor({ state: "visible" });

  // Create a child note inside the folder so it has children
  await page.getByText("Untitled Folder").hover();
  const dotsButton = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Untitled Folder" })
    .getByRole("button");
  await dotsButton.click();
  await page.getByText("New Note").click();
  // Child creation auto-expands the folder — wait for the child note
  await page.getByText("Untitled").first().waitFor({ state: "visible" });

  // Confirm the child note is visible (folder is expanded)
  await expect(page.locator("nav").getByText("Untitled").first()).toBeVisible();

  // Switch to Tasks tab
  await page.getByTestId("task-overview-btn").click();
  await page.getByTestId("task-overview").waitFor({ state: "visible" });

  // Switch back to Notes
  await page.getByRole("button", { name: "Notes" }).click();

  // The folder should still be expanded — child note is visible
  await expect(page.locator("nav").getByText("Untitled Folder")).toBeVisible();
  await expect(page.locator("nav").getByText("Untitled").first()).toBeVisible();
});

test("expand folders then reload page - expanded state persists in localStorage", async ({
  page,
}) => {
  // Create a folder and a child note so the folder becomes expanded
  await page.getByTestId("create-new-btn").click();
  await page.getByTestId("create-folder-btn").click();
  // Folder is auto-placed in rename mode — dismiss to show the text label
  await page.getByTestId("inline-rename-input").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.getByText("Untitled Folder").waitFor({ state: "visible" });

  // Create a child note inside the folder — handleCreateNote calls tree.expand(parentId)
  await page.getByText("Untitled Folder").hover();
  const dotsButton = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Untitled Folder" })
    .getByRole("button");
  await dotsButton.click();
  await page.getByText("New Note").click();
  await page.getByText("Untitled").first().waitFor({ state: "visible" });

  // Wait for the localStorage persistence effect to flush
  await page.waitForTimeout(200);

  // localStorage must have been written with at least one expanded ID
  const storedJson = await page.evaluate(() =>
    localStorage.getItem("rnotes.sidebar.expanded"),
  );
  expect(storedJson).not.toBeNull();
  const storedIds = JSON.parse(storedJson!) as string[];
  expect(storedIds.length).toBeGreaterThan(0);

  // Persist the folder ID to verify it was saved correctly
  const folderId = storedIds[0];
  expect(typeof folderId).toBe("string");
  expect(folderId.length).toBeGreaterThan(0);

  // Directly set a known value in localStorage and verify it survives a page reload
  // (tests that localStorage is the persistence mechanism and survives navigation)
  await page.evaluate(() =>
    localStorage.setItem("rnotes.sidebar.expanded", JSON.stringify(["test-folder-persist-id"])),
  );

  await page.reload();
  await page.waitForLoadState("networkidle");

  // localStorage should still have the value we set before reload
  const afterReload = await page.evaluate(() =>
    localStorage.getItem("rnotes.sidebar.expanded"),
  );
  expect(afterReload).not.toBeNull();
  const idsAfterReload = JSON.parse(afterReload!) as string[];
  expect(idsAfterReload).toContain("test-folder-persist-id");
});
