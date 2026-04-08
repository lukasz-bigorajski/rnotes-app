import { test, expect } from "./fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
});

test("export menu button is visible in toolbar", async ({ page }) => {
  const exportBtn = page.getByTestId("export-menu-button");
  await expect(exportBtn).toBeVisible();
});

test("export menu opens with JSON and PDF options", async ({ page }) => {
  await page.getByTestId("export-menu-button").click();
  await expect(page.getByTestId("export-json-item")).toBeVisible();
  await expect(page.getByTestId("export-pdf-item")).toBeVisible();
});

test("export as JSON triggers a download", async ({ page }) => {
  // Intercept the download event
  const downloadPromise = page.waitForEvent("download", { timeout: 5000 });

  await page.getByTestId("export-menu-button").click();
  await page.getByTestId("export-json-item").click();

  const download = await downloadPromise;
  const suggestedFilename = download.suggestedFilename();
  expect(suggestedFilename).toMatch(/\.json$/);
  expect(suggestedFilename).toContain("Test Note");
});

test("exported JSON contains note data", async ({ page }) => {
  // Type some content so the note has data
  await page.locator("[contenteditable]").click();
  await page.keyboard.type("Export test content");

  const downloadPromise = page.waitForEvent("download", { timeout: 5000 });

  await page.getByTestId("export-menu-button").click();
  await page.getByTestId("export-json-item").click();

  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const json = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as {
    version: string;
    exportedAt: string;
    note: {
      id: string;
      title: string;
      content: unknown;
      createdAt: string;
      updatedAt: string;
    };
  };

  expect(json.version).toBe("1");
  expect(json.exportedAt).toBeTruthy();
  expect(json.note.title).toBe("Test Note");
  expect(json.note.content).toBeTruthy();
  expect(json.note.createdAt).toBeTruthy();
  expect(json.note.updatedAt).toBeTruthy();
});

test("export as PDF triggers a download", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });

  await page.getByTestId("export-menu-button").click();
  await page.getByTestId("export-pdf-item").click();

  const download = await downloadPromise;
  const suggestedFilename = download.suggestedFilename();
  expect(suggestedFilename).toMatch(/\.pdf$/);
  expect(suggestedFilename).toContain("Test Note");
});
