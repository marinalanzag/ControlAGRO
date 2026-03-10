import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const environment = process.argv[2] || "default";
const configPath = path.join(rootDir, "capacitor.config.json");
const environmentsDir = path.join(rootDir, "config", "environments");

const defaultConfig = {
  appId: "br.com.controlagro.app",
  appName: "ControlAGRO",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https"
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "DARK"
    }
  }
};

async function loadEnvironmentConfig() {
  if (environment === "default") {
    return {};
  }

  const environmentPath = path.join(environmentsDir, `${environment}.json`);
  return JSON.parse(await readFile(environmentPath, "utf8"));
}

async function main() {
  const environmentConfig = await loadEnvironmentConfig();
  const capacitorConfig = {
    ...defaultConfig,
    appId: environmentConfig.appId || defaultConfig.appId,
    appName: environmentConfig.appName || defaultConfig.appName
  };

  await writeFile(configPath, `${JSON.stringify(capacitorConfig, null, 2)}\n`, "utf8");
  console.log(`capacitor.config.json atualizado para o ambiente: ${environment}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
