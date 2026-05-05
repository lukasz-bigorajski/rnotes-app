import { readFileSync, writeFileSync } from "fs";

const version = process.env.GITHUB_REF_NAME.replace(/^v/, "");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = version;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

let cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
cargo = cargo.replace(/^version = ".*?"/m, `version = "${version}"`);
writeFileSync("src-tauri/Cargo.toml", cargo);

const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
conf.version = version;
writeFileSync("src-tauri/tauri.conf.json", JSON.stringify(conf, null, 2) + "\n");

console.log("Version set to: " + version);
