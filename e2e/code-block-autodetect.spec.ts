import { test, expect } from "./fixtures/tauri-mock";

test.use({
  launchOptions: {
    args: ["--enable-features=UnsafeWebGPU"],
  },
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByText("Test Note").click();
  await page.locator("[contenteditable]").waitFor({ state: "visible" });
});

// Enough Rust code to exceed the 20-char minimum and be unambiguously detected.
const RUST_SNIPPET = `fn main() {
    let v: Vec<u32> = vec![1, 2, 3];
    for x in &v {
        println!("{}", x);
    }
}`;

test("auto-detects Rust when language is plaintext", async ({ page }) => {
  const editor = page.locator("[contenteditable]");
  await editor.click();

  // Insert a code block via the triple-backtick markdown shortcut.
  await page.keyboard.type("```");
  await page.keyboard.press("Enter");

  // Type Rust code into the code block.
  await page.keyboard.type(RUST_SNIPPET);

  // Wait for the 500ms debounce + some buffer.
  await page.waitForTimeout(1200);

  const select = page.locator("[data-testid='code-block-language-select']").first();
  await expect(select).toHaveValue("rust");
});

test("does not overwrite a user-chosen language", async ({ page }) => {
  const editor = page.locator("[contenteditable]");
  await editor.click();

  // Insert a code block.
  await page.keyboard.type("```");
  await page.keyboard.press("Enter");

  // Manually select Python before typing any code.
  const select = page.locator("[data-testid='code-block-language-select']").first();
  await select.selectOption("python");

  // Type Rust code (which would be detected as rust if autodetect ran).
  await page.keyboard.type(RUST_SNIPPET);

  // Wait for debounce + buffer.
  await page.waitForTimeout(1200);

  // Language should remain python — the user's explicit choice.
  await expect(select).toHaveValue("python");
});
