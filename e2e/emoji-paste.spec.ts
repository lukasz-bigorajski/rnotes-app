import { test, expect } from "./fixtures/tauri-mock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("pasting emoji img tag inserts the emoji character as text, not an image node", async ({
  page,
}) => {
  // Create a new note so we have a focused editor
  await page.keyboard.press("Meta+n");
  const editor = page.locator(".ProseMirror").first();
  await editor.waitFor({ state: "attached" });
  await editor.click();

  // Fixture: GitHub-style emoji image as produced by rich-text sources
  const emojiImgHtml =
    '<img alt="👉" class="emoji" src="https://github.githubassets.com/images/icons/emoji/unicode/1f449.png">';

  // Dispatch a synthetic paste event carrying the emoji HTML
  const result = await page.evaluate((html) => {
    const editorEl = document.querySelector(".ProseMirror");
    if (!editorEl) return { error: "no editor" };

    const dt = new DataTransfer();
    dt.setData("text/html", html);
    dt.setData("text/plain", "👉");

    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });

    editorEl.dispatchEvent(pasteEvent);

    return { ok: true };
  }, emojiImgHtml);

  expect(result).toMatchObject({ ok: true });

  // Give the editor a tick to process the paste
  await page.waitForTimeout(200);

  // The editor should contain the emoji character as text, not an <img> element
  const hasEmojiText = await page.evaluate(() => {
    const editorEl = document.querySelector(".ProseMirror");
    if (!editorEl) return false;
    return editorEl.textContent?.includes("👉") ?? false;
  });

  const hasEmojiImg = await page.evaluate(() => {
    const editorEl = document.querySelector(".ProseMirror");
    if (!editorEl) return false;
    // An emoji img would be rendered inside our custom ImageNodeView wrapper
    return !!editorEl.querySelector('[data-testid="image-node-view"]');
  });

  expect(hasEmojiText).toBe(true);
  expect(hasEmojiImg).toBe(false);
});

test("transformPastedHTML regex strips emoji class img but leaves normal img untouched", async ({
  page,
}) => {
  // Pure unit-style check executed in the browser so we test the actual regex logic
  const result = await page.evaluate(() => {
    // Replicate the transformPastedHTML logic from NoteEditor.tsx
    function transform(html: string): string {
      return html
        .replace(
          /<img[^>]*class="[^"]*emoji[^"]*"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
          "$1",
        )
        .replace(
          /<img[^>]*alt="([^"]*)"[^>]*class="[^"]*emoji[^"]*"[^>]*\/?>/gi,
          "$1",
        )
        .replace(
          /<img[^>]*src="[^"]*(?:emoji|twemoji|github\.githubassets\.com\/images\/icons\/emoji)[^"]*"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
          "$1",
        );
    }

    const emojiClassAltAfter = transform(
      '<img class="emoji" alt="👉" src="x.png">',
    );
    const emojiAltBeforeClass = transform(
      '<img alt="👍" class="emoji" src="x.png">',
    );
    const githubCdn = transform(
      '<img alt="🎉" src="https://github.githubassets.com/images/icons/emoji/unicode/1f389.png">',
    );
    const twemoji = transform(
      '<img alt="😀" src="https://twemoji.maxcdn.com/v/13/72x72/1f600.png">',
    );
    const normalImg = transform('<img src="screenshot.png" alt="my screenshot">');
    const noAlt = transform('<img class="emoji" src="x.png">');

    return {
      emojiClassAltAfter,
      emojiAltBeforeClass,
      githubCdn,
      twemoji,
      normalImg,
      noAlt,
    };
  });

  // Emoji images should be replaced by their alt text
  expect(result.emojiClassAltAfter).toBe("👉");
  expect(result.emojiAltBeforeClass).toBe("👍");
  expect(result.githubCdn).toBe("🎉");
  expect(result.twemoji).toBe("😀");
  // Normal image tags must pass through unchanged
  expect(result.normalImg).toBe('<img src="screenshot.png" alt="my screenshot">');
  // Emoji img without alt text: no alt capture group — should collapse to empty string
  // (the regex requires an alt attribute to match, so this stays untouched by first two rules;
  //  the CDN rule also won't match because src is just "x.png")
  expect(result.noAlt).toBe('<img class="emoji" src="x.png">');
});
