import { spawnSync } from "node:child_process";

const [action, target, confirmation] = process.argv.slice(2);
const compose = (...args) => {
  const command = process.platform === "win32" ? "docker.exe" : "docker";
  const result = spawnSync(command, ["compose", ...args], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
};

if (action === "up") compose("up", "--build", "-d");
else if (action === "down") compose("down");
else if (action === "restart") compose("restart", ...(target ? [target] : []));
else if (action === "status") compose("ps");
else if (action === "logs") compose("logs", "-f", "--tail=200", ...(target ? [target] : []));
else if (action === "uninstall") {
  if (confirmation !== "remove-local-solar4u-data") {
    console.error("Refusing to delete local volumes. Re-run with confirmation: remove-local-solar4u-data");
    process.exitCode = 2;
  } else compose("down", "--volumes", "--remove-orphans");
} else {
  console.error("Usage: node scripts/local-ops.mjs <up|down|restart|status|logs|uninstall> [service] [confirmation]");
  process.exitCode = 2;
}
