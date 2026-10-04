import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const tauriConfig = JSON.parse(await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
const cargoToml = await readFile(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8");
const cargoVersion = /^version\s*=\s*"([^"]+)"/mu.exec(cargoToml)?.[1];
const versions = { package: packageJson.version, tauri: tauriConfig.version, cargo: cargoVersion };

if (Object.values(versions).some((version) => typeof version !== "string" || version !== packageJson.version)) {
  console.error(`ScriptArc version values must match: ${JSON.stringify(versions)}`);
  process.exit(1);
}

const tag = process.argv[2];
if (tag && (!/^v\d+\.\d+\.\d+$/u.test(tag) || tag !== `v${packageJson.version}`)) {
  console.error(`Release tag ${tag} must match the project version v${packageJson.version}.`);
  process.exit(1);
}

console.log(`ScriptArc version is consistent: ${packageJson.version}`);
