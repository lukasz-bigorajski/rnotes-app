import { test, expect } from "./fixtures/tauri-mock";

test("drag note to last position by dropping on bottom half of last item", async ({
  page,
}) => {
  await page.goto("/");

  // Initial state: "Test Note" exists (seed, sort_order=0)
  await expect(page.locator("nav").getByText("Test Note")).toBeVisible();

  // Create two more notes so we have 3 items
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await page.locator("nav").getByText("Untitled").first().waitFor({ state: "visible" });

  // Rename the second note to "Note B" via context menu
  await page.locator("nav").getByText("Untitled").first().hover();
  const dotsB = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Untitled" })
    .first()
    .getByRole("button");
  await dotsB.click();
  await page.getByText("Rename").click();
  const inputB = page.getByTestId("inline-rename-input");
  await inputB.fill("Note B");
  await page.keyboard.press("Enter");
  await page.locator("nav").getByText("Note B").waitFor({ state: "visible" });

  // Create a third note
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await page.locator("nav").getByText("Untitled").first().waitFor({ state: "visible" });

  // Rename to "Note C"
  await page.locator("nav").getByText("Untitled").first().hover();
  const dotsC = page
    .locator('[class*="treeNode"]')
    .filter({ hasText: "Untitled" })
    .first()
    .getByRole("button");
  await dotsC.click();
  await page.getByText("Rename").click();
  const inputC = page.getByTestId("inline-rename-input");
  await inputC.fill("Note C");
  await page.keyboard.press("Enter");
  await page.locator("nav").getByText("Note C").waitFor({ state: "visible" });

  // Current order in sidebar (by sort_order): Test Note, Note B, Note C
  // We want to move "Test Note" to LAST position (after "Note C")

  const testNote = page.locator("nav").getByText("Test Note");
  const noteC = page.locator("nav").getByText("Note C");

  const testNoteBox = await testNote.boundingBox();
  const noteCBox = await noteC.boundingBox();
  if (!testNoteBox || !noteCBox) {
    throw new Error("Could not get bounding boxes");
  }

  // Drag "Test Note" to the BOTTOM HALF of "Note C" (the last item)
  // This means the drag center is below Note C's midpoint → insertAfter = true
  await page.mouse.move(
    testNoteBox.x + testNoteBox.width / 2,
    testNoteBox.y + testNoteBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    noteCBox.x + noteCBox.width / 2,
    noteCBox.y + noteCBox.height * 0.8, // bottom 20% of Note C
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
