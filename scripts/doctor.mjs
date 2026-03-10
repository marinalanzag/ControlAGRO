import { access, constants, readFile } from "node:fs/promises";

const requiredFiles = [
  "index.html",
  "manifest.json",
  "sw.js",
  "logo.png",
  "package.json",
  "capacitor.config.json"
];

async function checkFiles() {
  for (const file of requiredFiles) {
    await access(file, constants.R_OK);
  }
}

async function checkLegacyHtml() {
  const html = await readFile("index.html", "utf8");
  const markers = ["<style>", "</style>", "<body>", "<script>", "</script>"];

  for (const marker of markers) {
    if (!html.includes(marker)) {
      throw new Error(`Marcador ausente no index.html: ${marker}`);
    }
  }
}

async function main() {
  await checkFiles();
  await checkLegacyHtml();
  console.log("Doctor OK: estrutura minima da migracao mobile presente.");
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
