/**
 * Search UX tests — covers feedback #15 and #16:
 *  #15 — local find (Cmd+F) scrolls to and highlights first match when query is typed
 *  #16 — global search (Cmd+K) input is focused immediately; selecting a result opens
 *         the note with the find bar pre-populated and first match scrolled into view
 */
import { test, expect } from "./fixtures/tauri-mock";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Open the note named "Test Note" and wait for the editor to be ready. */
async function openTestNote(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await expect(page.getByTestId("note-title-input")).toBeVisible();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
}

/** Type text into the TipTap contenteditable editor. */
async function typeInEditor(page: import("@playwright/test").Page, text: string) {
  await page.locator("[contenteditable]").click();
  await page.keyboard.type(text);
}

// ── #15: Local find bar scrolls to first match on query change ────────────────

test("local find: find bar opens with Cmd+F", async ({ page }) => {
  await openTestNote(page);
  await page.keyboard.press("Meta+f");
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });
});

test("local find: typing query shows match count", async ({ page }) => {
  await openTestNote(page);

  // Type some content into the editor
  await typeInEditor(page, "hello world hello");

  // Open find bar
  await page.keyboard.press("Meta+f");
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });

  // Type a search query that matches
  await page.getByTestId("find-input").fill("hello");

  // The counter should show matches (1/2 since there are two occurrences)
  // Wait for the match count to appear in the right section
  const findInput = page.getByTestId("find-input");
  await expect(findInput).toHaveValue("hello");

  // The find input's right section text should indicate matches found
  // We check that match count text appears somewhere in the find bar
  const bar = page.getByTestId("find-replace-bar");
  await expect(bar).toContainText(/\d+\/\d+/, { timeout: 1000 });
});

test("local find: find input is focused on open", async ({ page }) => {
  await openTestNote(page);
  await page.keyboard.press("Meta+f");
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });

  // The find input should be focused — we can type directly and it appears in the input
  await page.keyboard.type("test");
  await expect(page.getByTestId("find-input")).toHaveValue("test");
});

test("local find: no-match query shows 0/0", async ({ page }) => {
  await openTestNote(page);
  await page.keyboard.press("Meta+f");
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });

  await page.getByTestId("find-input").fill("xyzzy_no_match_999");

  const bar = page.getByTestId("find-replace-bar");
  await expect(bar).toContainText("0/0", { timeout: 1000 });
});

test("local find: next/prev buttons navigate between matches", async ({ page }) => {
  await openTestNote(page);

  // Type content with multiple occurrences
  await typeInEditor(page, "foo bar foo baz foo");

  await page.keyboard.press("Meta+f");
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });

  await page.getByTestId("find-input").fill("foo");
  const bar = page.getByTestId("find-replace-bar");
  await expect(bar).toContainText(/1\/3/, { timeout: 1000 });

  // Click next — should go to 2/3
  await page.getByTestId("find-next-btn").click();
  await expect(bar).toContainText(/2\/3/);

  // Click next again — should go to 3/3
  await page.getByTestId("find-next-btn").click();
  await expect(bar).toContainText(/3\/3/);

  // Click prev — should wrap to 2/3
  await page.getByTestId("find-prev-btn").click();
  await expect(bar).toContainText(/2\/3/);
});

test("local find: Escape closes find bar", async ({ page }) => {
  await openTestNote(page);
  await page.keyboard.press("Meta+f");
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });

  await page.getByTestId("find-input").press("Escape");
  await expect(page.getByTestId("find-replace-bar")).not.toBeVisible({ timeout: 1000 });
});

// ── #16: Global search focus + post-select scroll ────────────────────────────

test("global search: Cmd+K opens modal and input is focused", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Meta+k");
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });

  // Immediately type — keystrokes should land in the search input without extra clicks
  await page.keyboard.type("Test");
  await expect(page.getByTestId("global-search-input")).toHaveValue("Test");
});

test("global search: sidebar button focuses input immediately", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("open-global-search-btn").click();
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });

  // Type immediately without clicking the input first
  await page.keyboard.type("Note");
  await expect(page.getByTestId("global-search-input")).toHaveValue("Note");
});

test("global search: Enter on result opens note and find bar is shown with query", async ({
  page,
}) => {
  await page.goto("/");

  // Open global search
  await page.keyboard.press("Meta+k");
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });

  // Search for "Test" — the seed note "Test Note" should appear
  await page.getByTestId("global-search-input").fill("Test");
  await expect(page.getByTestId("global-search-results")).toBeVisible({ timeout: 1000 });

  // Press Enter to open the first result
  await page.keyboard.press("Enter");

  // Modal should close
  await expect(page.getByTestId("global-search-modal")).not.toBeVisible({ timeout: 2000 });

  // Note editor should be open
  await expect(page.getByTestId("note-title-input")).toBeVisible({ timeout: 2000 });

  // The find bar should open automatically with the search query pre-populated
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });
  await expect(page.getByTestId("find-input")).toHaveValue("Test");
});

test("global search: clicking result opens note and find bar is shown with query", async ({
  page,
}) => {
  await page.goto("/");

  // Open global search via sidebar
  await page.getByTestId("open-global-search-btn").click();
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });

  // Search for "Note"
  await page.getByTestId("global-search-input").fill("Note");
  await expect(page.getByTestId("global-search-results")).toBeVisible({ timeout: 1000 });

  // Click the first result
  await page.getByTestId("global-search-result-item").first().click();

  // Modal should close
  await expect(page.getByTestId("global-search-modal")).not.toBeVisible({ timeout: 2000 });

  // Note editor should be open
  await expect(page.getByTestId("note-title-input")).toBeVisible({ timeout: 2000 });

  // The find bar should open with the search query
  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });
  await expect(page.getByTestId("find-input")).toHaveValue("Note");
});

test("global search: find bar can be closed after opening from search", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Meta+k");
  await expect(page.getByTestId("global-search-modal")).toBeVisible({ timeout: 2000 });

  await page.getByTestId("global-search-input").fill("Test");
  await expect(page.getByTestId("global-search-results")).toBeVisible({ timeout: 1000 });
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("find-replace-bar")).toBeVisible({ timeout: 2000 });

  // Close the find bar with Escape
  await page.getByTestId("find-input").press("Escape");
  await expect(page.getByTestId("find-replace-bar")).not.toBeVisible({ timeout: 1000 });
});
