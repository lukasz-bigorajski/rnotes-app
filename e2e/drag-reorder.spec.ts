import { test, expect } from "./fixtures/tauri-mock";

test("drag note to last position by dropping on bottom half of last item", async ({
  page,
}) => {
  await page.goto("/");

  // Initial state: "Test Note" exists (seed, sort_order=0)
  await expect(page.locator("nav").getByText("Test Note")).toBeVisible();

  // Create two more notes so we have 3 items
  await page.getByTestId("create-new-btn").click();
  await page.getByTestId("create-note-btn").click();
  // Note is auto-placed in rename mode — fill the title directly
  const inputB = page.getByTestId("inline-rename-input");
  await inputB.waitFor({ state: "visible" });
  await inputB.fill("Note B");
  await page.keyboard.press("Enter");
  await page.locator("nav").getByText("Note B").waitFor({ state: "visible" });

  // Create a third note
  await page.getByTestId("create-new-btn").click();
  await page.getByTestId("create-note-btn").click();
  const inputC = page.getByTestId("inline-rename-input");
  await inputC.waitFor({ state: "visible" });
  await inputC.fill("Note C");
  await page.keyboard.press("Enter");
  await page.locator("nav").getByText("Note C").waitFor({ state: "visible" });
  // Let the tree finish re-rendering after the note reload triggered by rename submit
  await page.waitForTimeout(150);

  // Current order in sidebar (by sort_order): Test Note, Note B, Note C
  // We want to move "Test Note" to LAST position (after "Note C")

  const testNote = page.locator("nav").getByText("Test Note");
  const noteC = page.locator("nav").getByText("Note C");

  // Scroll the sidebar tree to the top so both source and target are in the viewport
  await testNote.scrollIntoViewIfNeeded();

  const testNoteBox = await testNote.boundingBox();
  const noteCBox = await noteC.boundingBox();
  if (!testNoteBox || !noteCBox) {
    throw new Error("Could not get bounding boxes");
  }

  // Drag "Test Note" to the BOTTOM HALF of "Note C" (the last item).
  // dnd-kit's PointerSensor requires a small "wake-up" move after pointerdown
  // before it attaches its internal pointermove listeners (distance constraint).
  const startX = testNoteBox.x + testNoteBox.width / 2;
  const startY = testNoteBox.y + testNoteBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Small wake-up move to satisfy the distance: 8 activation constraint
  await page.mouse.move(startX + 1, startY + 10, { steps: 3 });
  // Now move to the bottom 80% of Note C (below its midpoint → insertAfter = true)
  await page.mouse.move(
    noteCBox.x + noteCBox.width / 2,
    noteCBox.y + noteCBox.height * 0.8,
    { steps: 15 },
  );
  await page.mouse.up();

  // Wait for the move to complete
  await page.waitForTimeout(300);

  // Now the order should be: Note B, Note C, Test Note
  // Get all tree node span labels in order (use span to avoid matching the Group wrapper)
  const labels = await page.locator("nav span[class*='label']").allTextContents();
  const noteLabels = labels.filter((l) => ["Test Note", "Note B", "Note C"].includes(l));

  expect(noteLabels).toEqual(["Note B", "Note C", "Test Note"]);
});
