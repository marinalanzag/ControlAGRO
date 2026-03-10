import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, "logo.png");
const iosIconDir = path.join(rootDir, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");
const androidResDir = path.join(rootDir, "android", "app", "src", "main", "res");

const iosIcons = [
  { filename: "AppIcon-20@2x.png", size: 40, idiom: "iphone", scale: "2x", pointSize: "20x20" },
  { filename: "AppIcon-20@3x.png", size: 60, idiom: "iphone", scale: "3x", pointSize: "20x20" },
  { filename: "AppIcon-29@2x.png", size: 58, idiom: "iphone", scale: "2x", pointSize: "29x29" },
  { filename: "AppIcon-29@3x.png", size: 87, idiom: "iphone", scale: "3x", pointSize: "29x29" },
  { filename: "AppIcon-40@2x.png", size: 80, idiom: "iphone", scale: "2x", pointSize: "40x40" },
  { filename: "AppIcon-40@3x.png", size: 120, idiom: "iphone", scale: "3x", pointSize: "40x40" },
  { filename: "AppIcon-60@2x.png", size: 120, idiom: "iphone", scale: "2x", pointSize: "60x60" },
  { filename: "AppIcon-60@3x.png", size: 180, idiom: "iphone", scale: "3x", pointSize: "60x60" },
  { filename: "AppIcon-20.png", size: 20, idiom: "ipad", scale: "1x", pointSize: "20x20" },
  { filename: "AppIcon-20@2x-ipad.png", size: 40, idiom: "ipad", scale: "2x", pointSize: "20x20" },
  { filename: "AppIcon-29.png", size: 29, idiom: "ipad", scale: "1x", pointSize: "29x29" },
  { filename: "AppIcon-29@2x-ipad.png", size: 58, idiom: "ipad", scale: "2x", pointSize: "29x29" },
  { filename: "AppIcon-40.png", size: 40, idiom: "ipad", scale: "1x", pointSize: "40x40" },
  { filename: "AppIcon-40@2x-ipad.png", size: 80, idiom: "ipad", scale: "2x", pointSize: "40x40" },
  { filename: "AppIcon-76.png", size: 76, idiom: "ipad", scale: "1x", pointSize: "76x76" },
  { filename: "AppIcon-76@2x.png", size: 152, idiom: "ipad", scale: "2x", pointSize: "76x76" },
  { filename: "AppIcon-83.5@2x.png", size: 167, idiom: "ipad", scale: "2x", pointSize: "83.5x83.5" },
  { filename: "AppIcon-1024.png", size: 1024, idiom: "ios-marketing", scale: "1x", pointSize: "1024x1024" }
];

const androidIcons = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 }
];

function resizePng(inputPath, outputPath, size) {
  execFileSync("sips", ["-s", "format", "png", inputPath, "--resampleHeightWidth", String(size), String(size), "--out", outputPath], {
    stdio: "ignore"
  });
}

async function generateIosIcons(sourcePngPath) {
  await mkdir(iosIconDir, { recursive: true });
  for (const icon of iosIcons) {
    resizePng(sourcePngPath, path.join(iosIconDir, icon.filename), icon.size);
  }

  const contents = {
    images: iosIcons.map(icon => ({
      filename: icon.filename,
      idiom: icon.idiom,
      scale: icon.scale,
      size: icon.pointSize
    })),
    info: {
      author: "codex",
      version: 1
    }
  };

  await writeFile(path.join(iosIconDir, "Contents.json"), JSON.stringify(contents, null, 2), "utf8");
}

async function generateAndroidIcons(sourcePngPath) {
  for (const icon of androidIcons) {
    const targetDir = path.join(androidResDir, icon.dir);
    await mkdir(targetDir, { recursive: true });
    resizePng(sourcePngPath, path.join(targetDir, "ic_launcher.png"), icon.size);
    resizePng(sourcePngPath, path.join(targetDir, "ic_launcher_round.png"), icon.size);
    resizePng(sourcePngPath, path.join(targetDir, "ic_launcher_foreground.png"), icon.size);
  }
}

async function main() {
  const tempPngPath = path.join(os.tmpdir(), "controlagro-icon-source.png");
  execFileSync("sips", ["-s", "format", "png", sourcePath, "--out", tempPngPath], { stdio: "ignore" });
  await generateIosIcons(tempPngPath);
  await generateAndroidIcons(tempPngPath);
  console.log("Icones nativos gerados a partir da logo.");
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
