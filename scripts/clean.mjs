import { rm } from "node:fs/promises";

async function main() {
  await rm("dist", { recursive: true, force: true });
  console.log("Diretorio dist removido.");
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
