import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const rootDir = process.cwd();
const environment = process.argv[2] || "default";
const environmentsDir = path.join(rootDir, "config", "environments");

const androidBuildGradlePath = path.join(rootDir, "android", "app", "build.gradle");
const androidStringsPath = path.join(rootDir, "android", "app", "src", "main", "res", "values", "strings.xml");
const androidManifestPath = path.join(rootDir, "android", "app", "src", "main", "AndroidManifest.xml");
const iosProjectPath = path.join(rootDir, "ios", "App", "App.xcodeproj", "project.pbxproj");
const iosInfoPlistPath = path.join(rootDir, "ios", "App", "App", "Info.plist");

const defaultIdentity = {
  appId: "br.com.controlagro.app",
  appName: "ControlAGRO"
};

async function loadEnvironmentIdentity() {
  if (environment === "default") {
    return defaultIdentity;
  }

  const environmentPath = path.join(environmentsDir, `${environment}.json`);
  const environmentConfig = JSON.parse(await readFile(environmentPath, "utf8"));
  return {
    appId: environmentConfig.appId || defaultIdentity.appId,
    appName: environmentConfig.appName || defaultIdentity.appName
  };
}

async function updateAndroidBuildGradle(identity) {
  let content = await readFile(androidBuildGradlePath, "utf8");
  content = content.replace(/namespace = ".*"/, `namespace = "${identity.appId}"`);
  content = content.replace(/applicationId ".*"/, `applicationId "${identity.appId}"`);
  await writeFile(androidBuildGradlePath, content, "utf8");
}

async function updateAndroidStrings(identity) {
  let content = await readFile(androidStringsPath, "utf8");
  content = content.replace(/<string name="app_name">.*<\/string>/, `<string name="app_name">${identity.appName}</string>`);
  content = content.replace(/<string name="title_activity_main">.*<\/string>/, `<string name="title_activity_main">${identity.appName}</string>`);
  content = content.replace(/<string name="package_name">.*<\/string>/, `<string name="package_name">${identity.appId}</string>`);
  content = content.replace(/<string name="custom_url_scheme">.*<\/string>/, `<string name="custom_url_scheme">${identity.appId}</string>`);
  await writeFile(androidStringsPath, content, "utf8");
}

async function updateAndroidManifestPermissions() {
  let content = await readFile(androidManifestPath, "utf8");
  const permissions = [
    '    <uses-permission android:name="android.permission.INTERNET" />',
    '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
    '    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '    <uses-permission android:name="android.permission.CAMERA" />'
  ];

  content = content.replace(/    <!-- Permissions -->[\s\S]*<\/manifest>/, `    <!-- Permissions -->\n\n${permissions.join("\n")}\n</manifest>`);
  await writeFile(androidManifestPath, content, "utf8");
}

async function updateIosProject(identity) {
  let content = await readFile(iosProjectPath, "utf8");
  content = content.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${identity.appId};`);
  content = content.replace(/PRODUCT_NAME = App;/g, `PRODUCT_NAME = "${identity.appName}";`);
  await writeFile(iosProjectPath, content, "utf8");
}

async function updateIosInfoPlist(identity) {
  let content = await readFile(iosInfoPlistPath, "utf8");
  content = content.replace(/<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/, `<key>CFBundleDisplayName</key>\n        <string>${identity.appName}</string>`);

  const permissionBlock = `
\t<key>NSCameraUsageDescription</key>
\t<string>O aplicativo usa a camera para registrar fotos das visitas tecnicas.</string>
\t<key>NSLocationWhenInUseUsageDescription</key>
\t<string>O aplicativo usa sua localizacao para registrar onde a visita foi realizada.</string>
\t<key>NSPhotoLibraryUsageDescription</key>
\t<string>O aplicativo permite selecionar fotos para anexar as visitas e clientes.</string>`;

  if (!content.includes("NSCameraUsageDescription")) {
    content = content.replace(/\t<key>UIViewControllerBasedStatusBarAppearance<\/key>\s*<true\/>/, `${permissionBlock}\n\t<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<true/>`);
  }

  await writeFile(iosInfoPlistPath, content, "utf8");
}

async function main() {
  const identity = await loadEnvironmentIdentity();
  execFileSync("node", [path.join(rootDir, "scripts", "generate-app-icons.mjs")], { stdio: "inherit" });
  await updateAndroidBuildGradle(identity);
  await updateAndroidStrings(identity);
  await updateAndroidManifestPermissions();
  await updateIosProject(identity);
  await updateIosInfoPlist(identity);
  console.log(`Branding nativo aplicado para o ambiente: ${environment}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
