/**
 * Image resize & alignment Playwright tests.
 *
 * Because these tests run in a Vite dev server (not Tauri), we inject a test
 * image by setting editor content via the mock note JSON directly. The mock
 * fixture returns a 1×1 GIF data-URI for `get_image_url`, which is enough
 * to exercise the NodeView.
 */
import { test, expect } from "./fixtures/tauri-mock";

// A minimal TipTap JSON document containing one image node.
const docWithImage = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "image",
      attrs: {
        src: "assets/test-note-1/test.png",
        alt: "test image",
        width: 300,
        height: 200,
        align: "center",
      },
    },
    { type: "paragraph" },
  ],
});

test.beforeEach(async ({ page }) => {
  // Patch the mock to return a note with image content
  await page.addInitScript((content: string) => {
    const origInit = (window as any).__tauriMockContentOverride__;
    (window as any).__tauriMockImageContent__ = content;
  }, docWithImage);

  await page.goto("/");

  // Override the note content in the mock store before clicking the note
  await page.evaluate((content: string) => {
    const internals = (window as any).__TAURI_INTERNALS__;
    const origInvoke = internals.invoke.bind(internals);
    internals.invoke = (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "get_note" && (args?.id as string) === "test-note-1") {
        return Promise.resolve({
          id: "test-note-1",
          parent_id: null,
          title: "Test Note",
          content,
          sort_order: 0,
          is_folder: false,
          deleted_at: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }
      return origInvoke(cmd, args);
    };
  }, docWithImage);

  await page.getByText("Test Note").click();
  // Wait for the main editor (the ProseMirror/TipTap contenteditable div)
  await page.locator(".tiptap").waitFor({ state: "visible" });
  // Wait for the image NodeView to appear (resolveImageUrls triggers after mount)
  await page.locator('[data-testid="image-node-view"]').waitFor({ state: "visible", timeout: 5000 });
});

test("image node view renders with data-testid", async ({ page }) => {
  const imageView = page.locator('[data-testid="image-node-view"]');
  await expect(imageView).toBeVisible();
});

test("image element is present inside the node view", async ({ page }) => {
  const img = page.locator('[data-testid="image-element"]');
  await expect(img).toBeVisible();
});

test("resize handles are hidden when image is not selected", async ({ page }) => {
  // Click the paragraph inside the editor to move the ProseMirror cursor there,
  // which deselects the image node. Clicking outside the editor does not
  // update TipTap's internal selection, so the image would still appear selected.
  await page.locator(".tiptap p").click();

  // Handles should exist in DOM but be transparent (opacity 0) when not selected
  const handle = page.locator('[data-testid="image-handle-se"]');
  await expect(handle).toBeAttached();

  // Verify the wrapper does not have the 'selected' class applied
  const wrapper = page.locator('[data-testid="image-node-view"]');
  const className = await wrapper.getAttribute("class");
  expect(className).not.toContain("selected");
});

test("clicking an image selects it and shows resize handles", async ({ page }) => {
  const img = page.locator('[data-testid="image-element"]');
  await img.click();

  // After clicking, the NodeView wrapper should have the 'selected' CSS class
  const wrapper = page.locator('[data-testid="image-node-view"]');
  // The selected class is applied by TipTap when the node is selected
  // Verify that at least the SE handle becomes visible
  const handleSE = page.locator('[data-testid="image-handle-se"]');
  await expect(handleSE).toBeVisible({ timeout: 3000 });
});

test("alignment toolbar is visible when image is selected", async ({ page }) => {
  const img = page.locator('[data-testid="image-element"]');
  await img.click();

  const alignCenter = page.locator('[data-testid="image-align-center"]');
  await expect(alignCenter).toBeVisible({ timeout: 3000 });
});

test("alignment buttons exist for left, center, right", async ({ page }) => {
  const img = page.locator('[data-testid="image-element"]');
  await img.click();

  await expect(page.locator('[data-testid="image-align-left"]')).toBeVisible();
  await expect(page.locator('[data-testid="image-align-center"]')).toBeVisible();
  await expect(page.locator('[data-testid="image-align-right"]')).toBeVisible();
});

test("image has correct initial dimensions from node attributes", async ({ page }) => {
  const img = page.locator('[data-testid="image-element"]');
  const width = await img.getAttribute("width");
  const height = await img.getAttribute("height");
  // The node was created with width=300, height=200
  expect(width).toBe("300");
  expect(height).toBe("200");
});

test("image resize handle is draggable (SE corner)", async ({ page }) => {
  const img = page.locator('[data-testid="image-element"]');

  // Click to select first
  await img.click();

  const handleSE = page.locator('[data-testid="image-handle-se"]');
  await expect(handleSE).toBeVisible({ timeout: 3000 });

  // Get initial image bounding box
  const box = await img.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  // Perform a drag on the SE handle to resize
  const handleBox = await handleSE.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) return;

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  // Drag 50px right and 33px down (maintaining ~3:2 aspect ratio)
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 50, startY + 33, { steps: 10 });
  await page.mouse.up();

  // After dragging, the image width attribute should have been updated
  // (the updateAttributes call fires on mouseup)
  await page.waitForTimeout(100); // let React re-render

  const newWidth = await img.getAttribute("width");
  const newWidthNum = newWidth ? parseInt(newWidth, 10) : 0;
  // Should be larger than 300 (the starting width)
  expect(newWidthNum).toBeGreaterThan(300);
});
