#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const output = path.resolve("public/systems-spansh.csv");

console.log("Running spansh export to", output);

await new Promise((resolve, reject) => {
  const p = spawn("node", [
    "scripts/spansh_radius_export.mjs",
    "-r",
    "Col 285 Sector FI-J c9-2",
    "-d",
    "75",
    "-o",
    output,
  ], { stdio: "inherit" });

  p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("Export script failed: " + code))));
});

try {
  const data = await fs.readFile(output, "utf8");
  const lines = data.trim().split(/\r?\n/);
  const count = Math.max(0, lines.length - 1); // exclude header
  console.log(`CSV present: ${output}`);
  console.log(`Rows (excluding header): ${count}`);
} catch (err) {
  console.error("CSV not found or could not be read:", err);
  process.exit(1);
}
