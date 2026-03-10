import { access, copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const runtimeEnv = process.argv[2] || "default";
const legacyHtmlPath = path.join(rootDir, "index.html");
const distDir = path.join(rootDir, "dist");
const srcDir = path.join(rootDir, "src");
const configDir = path.join(rootDir, "config", "environments");
const stylesDir = path.join(srcDir, "styles");
const scriptsDir = path.join(srcDir, "scripts");
const stylesPath = path.join(stylesDir, "app.css");
const appScriptPath = path.join(scriptsDir, "app.js");
const appHtmlPath = path.join(srcDir, "index.html");
const manifestPath = path.join(rootDir, "manifest.json");
const serviceWorkerPath = path.join(rootDir, "sw.js");
const logoPath = path.join(rootDir, "logo.png");

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.lastIndexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Nao foi possivel localizar bloco entre ${startMarker} e ${endMarker}.`);
  }

  return source.slice(start + startMarker.length, end).trim();
}

function buildSeedHtml(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>ControlAGRO - O Fazendeiro</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap">
  <link rel="manifest" href="./manifest.json">
  <link rel="stylesheet" href="./styles/app.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="./scripts/offline-db.js"></script>
  <script src="./scripts/data-loader.js"></script>
  <script src="./scripts/sync-engine.js"></script>
  <script src="./scripts/bootstrap-state.js"></script>
  <script src="./scripts/auth-session.js"></script>
  <script src="./scripts/auth-engine.js"></script>
  <script src="./scripts/runtime-config.js"></script>
  <script src="./scripts/app-config.js"></script>
</head>
<body>
${bodyHtml}
  <script src="./scripts/app.js"></script>
</body>
</html>
`;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadEnvironmentConfig() {
  if (runtimeEnv === "default") {
    return {};
  }

  const configPath = path.join(configDir, `${runtimeEnv}.json`);
  if (!(await pathExists(configPath))) {
    throw new Error(`Arquivo de ambiente nao encontrado: ${configPath}`);
  }

  return JSON.parse(await readFile(configPath, "utf8"));
}

function sanitizeEnvironmentConfig(config) {
  const sanitized = {};
  if (config.supabaseUrl) sanitized.supabaseUrl = config.supabaseUrl;
  if (config.supabaseAnonKey) sanitized.supabaseAnonKey = config.supabaseAnonKey;
  return sanitized;
}

function buildRuntimeConfigFile(config) {
  return `(function runtimeConfigOverride(globalScope) {
  globalScope.__CONTROLAGRO_CONFIG__ = ${JSON.stringify(config, null, 2)};
})(window);
`;
}

async function ensureDirs() {
  await mkdir(stylesDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(distDir, { recursive: true });
}

async function seedSourceFromLegacy() {
  const legacyHtml = await readFile(legacyHtmlPath, "utf8");
  const styleContent = extractBlock(legacyHtml, "<style>", "</style>");
  const bodyContent = extractBlock(legacyHtml, "<body>", "<script>");
  const scriptContent = extractBlock(legacyHtml, "<script>", "</script>");
  const seedHtml = buildSeedHtml(bodyContent.trim());

  await ensureDirs();

  if (!(await pathExists(stylesPath))) {
    await writeFile(stylesPath, `${styleContent}\n`, "utf8");
  }
  if (!(await pathExists(appScriptPath))) {
    await writeFile(appScriptPath, `${scriptContent}\n`, "utf8");
  }
  if (!(await pathExists(appHtmlPath))) {
    await writeFile(appHtmlPath, seedHtml, "utf8");
  }
}

async function main() {
  const environmentConfig = sanitizeEnvironmentConfig(await loadEnvironmentConfig());
  await seedSourceFromLegacy();
  await rm(distDir, { recursive: true, force: true });
  await ensureDirs();
  await cp(srcDir, distDir, { recursive: true });
  await writeFile(
    path.join(distDir, "scripts", "runtime-config.js"),
    buildRuntimeConfigFile(environmentConfig),
    "utf8"
  );

  await copyFile(manifestPath, path.join(distDir, "manifest.json"));
  await copyFile(serviceWorkerPath, path.join(distDir, "sw.js"));
  await copyFile(logoPath, path.join(distDir, "logo.png"));

  console.log(`Build web concluido em dist/ e fontes modulares geradas em src/. Ambiente: ${runtimeEnv}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
