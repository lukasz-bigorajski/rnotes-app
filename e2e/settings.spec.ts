import { test, expect } from "./fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("settings button exists in sidebar", async ({ page }) => {
  const btn = page.getByTestId("open-settings-btn");
  await expect(btn).toBeVisible();
});

test("clicking settings button shows settings page", async ({ page }) => {
  await page.getByTestId("open-settings-btn").click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("settings page has theme selector with Light/Dark/Auto options", async ({ page }) => {
  await page.getByTestId("open-settings-btn").click();
  const themeSelector = page.getByTestId("theme-selector");
  await expect(themeSelector).toBeVisible();
  await expect(themeSelector.getByText("Light")).toBeVisible();
  await expect(themeSelector.getByText("Dark")).toBeVisible();
  await expect(themeSelector.getByText("Auto")).toBeVisible();
});

test("settings page has auto-save interval input", async ({ page }) => {
  await page.getByTestId("open-settings-btn").click();
  await expect(page.getByTestId("auto-save-interval-input")).toBeVisible();
});

test("settings page has font size input", async ({ page }) => {
  await page.getByTestId("open-settings-btn").click();
  await expect(page.getByTestId("font-size-input")).toBeVisible();
});

test("settings page has font family select", async ({ page }) => {
  await page.getByTestId("open-settings-btn").click();
  await expect(page.getByTestId("font-family-select")).toBeVisible();
});

test("settings page has spell check toggle", async ({ page }) => {
  await page.getByTestId("open-settings-btn").click();
  await expect(page.getByTestId("spell-check-toggle")).toBeVisible();
});

test("changing theme to Dark does not crash", async ({ page }) => {
  await page.getByTestId("open-settings-btn").click();
  const themeSelector = page.getByTestId("theme-selector");
  await themeSelector.getByText("Dark").click();
  // Heading still visible — no crash
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("changing theme to Light does not crash", async ({ page }) => {
  await page.getByTestId("open-settings-btn").click();
  await page.getByTestId("theme-selector").getByText("Light").click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("clicking a note in sidebar returns to editor view", async ({ page }) => {
  // First open settings
  await page.getByTestId("open-settings-btn").click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  // Click the seed note in the sidebar
  await page.getByText("Test Note").click();

  // Settings heading should no longer be visible; editor should show
  await expect(page.getByRole("heading", { name: "Settings" })).not.toBeVisible();
  await expect(page.getByTestId("note-title-input")).toBeVisible();
});
