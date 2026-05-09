import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");

const target = process.argv[2];
const targetNames = {
  npm: "@guardrail-bridge/guardrail-bridge",
  clawhub: "guardrail-bridge",
};

if (!target || !(target in targetNames)) {
  console.error("Usage: node scripts/pack-release.mjs <npm|clawhub>");
  process.exit(1);
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

const originalText = await readFile(packageJsonPath, "utf8");
const packageJson = JSON.parse(originalText);
const originalName = packageJson.name;
const nextName = targetNames[target];

packageJson.name = nextName;

try {
  console.log(`Packing target: ${target}`);
  console.log(`Temporary package name: ${nextName}`);
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  await run("npm", ["pack"], rootDir);
} finally {
  packageJson.name = originalName;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}
