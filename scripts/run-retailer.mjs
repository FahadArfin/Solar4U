import { spawnSync } from "node:child_process";

const retailerId = process.argv[2];
if (!retailerId || !/^[a-z0-9-]+$/.test(retailerId)) {
  console.error("Usage: npm run scrape:retailer -- <retailer-id>");
  process.exit(1);
}

const result = spawnSync(
  "docker",
  ["compose", "run", "--rm", "price-worker", "node", "run.mjs", retailerId],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);
