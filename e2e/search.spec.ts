import { test, expect } from "./fixtures/tauri-mock";

// ── Global search (Cmd+K) ────────────────────────────────────────────────────

// Helper to open global search via the sidebar search bar
async function openGlobalSearch(page: import("@playwright/test").Page) {
  await page.getByTestId("open-global-search-btn").click();
}

test("global search: clicking sidebar search bar opens modal", async ({ page }) => {
  await page.goto("/");

  await openGlobalSearch(page);

  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });
});

test("global search: Cmd+K opens modal", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Meta+k");
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });
});

test("global search: type query shows results", async ({ page }) => {
  await page.goto("/");

  await openGlobalSearch(page);
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });

  await page.getByTestId("global-search-input").fill("Test");

  await expect(page.getByTestId("global-search-results")).toBeVisible({ timeout: 1000 });
  await expect(page.getByTestId("global-search-result-item").first()).toBeVisible();
});

test("global search: Escape closes modal", async ({ page }) => {
  await page.goto("/");

  await openGlobalSearch(page);
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });

  await page.keyboard.press("Escape");

  await expect(page.getByTestId("global-search-modal")).not.toBeVisible({ timeout: 1000 });
});

test("global search: no results shows empty state", async ({ page }) => {
  await page.goto("/");

  await openGlobalSearch(page);
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });

  await page.getByTestId("global-search-input").fill("xyzzy_no_match_12345");

  await expect(page.getByTestId("global-search-no-results")).toBeVisible({ timeout: 1000 });
});

// ── In-note find bar (Cmd+F) ─────────────────────────────────────────────────

test("in-note search: Cmd+F opens find bar", async ({ page }) => {
  await page.goto("/");

  // Open a note first
  await page.getByText("Test Note").click();
  // Wait for editor to be visible
  await expect(page.getByTestId("note-title-input")).toBeVisible();

  await page.keyboard.press("Meta+f");

  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });
});

test("in-note search: type query highlights find input", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Test Note").click();
  await expect(page.getByTestId("note-title-input")).toBeVisible();

  await page.keyboard.press("Meta+f");
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });

  await page.getByTestId("find-input").fill("hello");
  // The find input has the value we typed
  await expect(page.getByTestId("find-input")).toHaveValue("hello");
});

test("in-note search: next and previous navigation buttons exist", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Test Note").click();
  await expect(page.getByTestId("note-title-input")).toBeVisible();

  await page.keyboard.press("Meta+f");
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });

  await expect(page.getByTestId("find-next-btn")).toBeVisible();
  await expect(page.getByTestId("find-prev-btn")).toBeVisible();
});

test("in-note search: Escape closes find bar", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Test Note").click();
  await expect(page.getByTestId("note-title-input")).toBeVisible();

  await page.keyboard.press("Meta+f");
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });

  // Press Escape while find input is focused
  await page.getByTestId("find-input").press("Escape");

  await expect(page.getByTestId("find-replace-bar")).not.toBeVisible({ timeout: 1000 });
});

// ── Global search with Cmd+Shift+F ──────────────────────────────────────────────

test("global search: Cmd+Shift+F opens modal", async ({ page }) => {
  await page.goto("/");

  // Use keyboard shortcut Cmd+Shift+F
  await page.keyboard.press("Meta+Shift+f");

  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });
});

test("global search: Cmd+Shift+F and Cmd+K both open modal", async ({ page }) => {
  await page.goto("/");

  // Test Cmd+Shift+F
  await page.keyboard.press("Meta+Shift+f");
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });

  // Close the modal
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("global-search-modal")).not.toBeVisible();

  // Test Cmd+K also works
  await page.keyboard.press("Meta+k");
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });
});

test("global search: 3-character search returns results", async ({ page }) => {
  await page.goto("/");

  await openGlobalSearch(page);
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });

  // Test 3-character search
  await page.getByTestId("global-search-input").fill("Tes");

  await expect(page.getByTestId("global-search-results")).toBeVisible({ timeout: 1000 });
  await expect(page.getByTestId("global-search-result-item").first()).toBeVisible();
});

// ── Global find & replace with Cmd+Shift+R ──────────────────────────────────────

test("global find & replace: Cmd+Shift+R opens modal", async ({ page }) => {
  await page.goto("/");

  // Use keyboard shortcut Cmd+Shift+R
  await page.keyboard.press("Meta+Shift+r");

  await expect(page.getByTestId("global-find-replace-modal")).toBeVisible({ timeout: 2000 });
});

test("global find & replace: find field searches notes", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Meta+Shift+r");
  await expect(page.getByTestId("global-find-replace-modal")).toBeVisible({ timeout: 2000 });

  // Type in find field
  await page.getByTestId("global-find-input").fill("Test");

  // Should show results
  await expect(page.getByTestId("global-find-replace-results")).toBeVisible({ timeout: 1000 });
  await expect(page.getByTestId("global-find-replace-result-item").first()).toBeVisible();
});

test("global find & replace: replace field is editable", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Meta+Shift+r");
  await expect(page.getByTestId("global-find-replace-modal")).toBeVisible({ timeout: 2000 });

  // Type in find field to get results
  await page.getByTestId("global-find-input").fill("Note");

  await expect(page.getByTestId("global-find-replace-results")).toBeVisible({ timeout: 1000 });

  // Type in replace field
  await page.getByTestId("global-replace-input").fill("Document");

  // Verify value is set
  await expect(page.getByTestId("global-replace-input")).toHaveValue("Document");
});

test("global find & replace: Replace All button is visible and enabled with results", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Meta+Shift+r");
  await expect(page.getByTestId("global-find-replace-modal")).toBeVisible({ timeout: 2000 });

  // Fill find field to get results
  await page.getByTestId("global-find-input").fill("Test");
  await expect(page.getByTestId("global-find-replace-results")).toBeVisible({ timeout: 1000 });

  // Replace All button should be visible and enabled
  const replaceAllBtn = page.getByTestId("global-replace-all-button");
  await expect(replaceAllBtn).toBeVisible();
  await expect(replaceAllBtn).toBeEnabled();
});
