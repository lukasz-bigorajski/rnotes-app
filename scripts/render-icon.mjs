import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sharp = require("/opt/homebrew/lib/node_modules/sharp");

const svgBuffer = readFileSync(new URL("./icon.svg", import.meta.url));

await sharp(svgBuffer)
  .resize(1024, 1024)
  .png()
  .toFile(new URL("../src-tauri/icons/icon.png", import.meta.url).pathname);

console.log("icon.png (1024x1024) written");
