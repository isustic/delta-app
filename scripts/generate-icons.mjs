import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = join(root, "node_modules/@tauri-apps/cli/tauri.js");
const mark = join(root, "src/assets/delta-mark.svg");
const tile = join(root, "src/assets/delta-tile.svg");
const icons = join(root, "src-tauri/icons");
const scratch = mkdtempSync(join(tmpdir(), "delta-icons-"));

function generate(input, output, sizes = []) {
  execFileSync(process.execPath, [cli, "icon", input, "--output", output,
    ...sizes.flatMap((size) => ["--png", String(size)])], {
    cwd: root,
    stdio: "inherit",
  });
}

try {
  // The macOS body occupies 824/1024 of the canvas, matching standard Dock icons.
  // The 512-unit viewBox includes a 1-unit stroke outside the 410-unit rectangle.
  // Derive the macOS tile from the same vector master as every other icon.
  const source = readFileSync(mark, "utf8");
  const definitions = source.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
  const artwork = source.match(/<g transform="translate\(-10 0\)">[\s\S]*<\/g>/)?.[0];
  if (!definitions || !artwork) throw new Error("Delta mark is missing its definitions or artwork");
  writeFileSync(tile, `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512" fill="none">
  ${definitions.replace("</defs>", `<linearGradient id="tile" x1="80" y1="48" x2="432" y2="464" gradientUnits="userSpaceOnUse">
    <stop stop-color="#FCFEFF"/><stop offset="1" stop-color="#E4EFFB"/>
  </linearGradient></defs>`)}
  <rect x="51" y="51" width="410" height="410" rx="93" fill="url(#tile)" stroke="#CBDCEE" stroke-width="2"/>
  <g transform="translate(256 256) scale(.7541071429) translate(-256 -256)">${artwork}</g>
</svg>
`);
  // Transparent marks for Windows/Linux, including ICO and app-store sizes.
  generate(mark, icons);
  // macOS uses the same mark on a neutral rounded tile, including its Dock override.
  generate(tile, join(scratch, "macos"));
  copyFileSync(join(scratch, "macos/icon.icns"), join(icons, "icon.icns"));
  copyFileSync(join(scratch, "macos/icon.png"), join(icons, "macos-icon.png"));
  // Keep additional checked-in PNGs and the frontend raster asset in sync.
  generate(mark, join(scratch, "png"), [16, 32, 64, 128, 256, 512, 1024]);
  for (const size of [16, 64, 256, 512, 1024]) {
    copyFileSync(join(scratch, `png/${size}x${size}.png`), join(icons, `${size}x${size}.png`));
  }
  copyFileSync(join(scratch, "png/512x512.png"), join(root, "src/assets/delta-icon.png"));
  mkdirSync(join(root, "public"), { recursive: true });
  copyFileSync(mark, join(root, "public/delta-icon.svg"));
  copyFileSync(join(scratch, "png/32x32.png"), join(root, "public/favicon.png"));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
