/**
 * Guarantee exactly ONE dev server, every time.
 *
 * Runs automatically as npm's `predev` hook, so `npm run dev` cannot start a
 * second server no matter how many terminals are open.
 *
 * WHY THIS EXISTS
 * Two `next dev` processes pointed at one `.next` directory is silent, ongoing
 * corruption. Each rebuilds `.next/static/*` and rewrites the build manifest
 * with fresh chunk ids; whichever writes last leaves the other serving HTML
 * that references chunk filenames no longer on disk. The browser then 404s on
 * `main-app.js` and `layout.css` and paints raw, unstyled HTML — a giant SVG
 * logo and no Tailwind. The same collision shows up as:
 *
 *   TypeError: __webpack_modules__[moduleId] is not a function
 *   Error: Cannot find module './1682.js'
 *
 * Restarting fixes it until the next collision, which is why it kept coming
 * back. Preventing the second server is the actual fix.
 *
 * Deleting `.next` after killing a duplicate is deliberate: by the time two
 * servers have overlapped, the directory is already inconsistent, and a stale
 * manifest survives a restart.
 */
import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = "ensure-single-dev";

/** Processes that are a `next dev` / `next start` for THIS project. */
function findServers() {
  try {
    if (process.platform === "win32") {
      // -Wrap/-AutoSize mangle long command lines; JSON keeps them intact.
      const raw = execSync(
        "powershell -NoProfile -Command \"Get-CimInstance Win32_Process | " +
          "Where-Object { $_.CommandLine } | " +
          "Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress\"",
        { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
      );
      const list = JSON.parse(raw || "[]");
      return (Array.isArray(list) ? list : [list])
        .filter((p) => p && p.CommandLine)
        .map((p) => ({ pid: Number(p.ProcessId), cmd: String(p.CommandLine) }))
        .filter(isProjectServer);
    }
    const raw = execSync("ps -eo pid=,args=", { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf(" ");
        return { pid: Number(line.slice(0, i)), cmd: line.slice(i + 1) };
      })
      .filter(isProjectServer);
  } catch {
    return []; // Never block `npm run dev` because process listing failed.
  }
}

function isProjectServer({ pid, cmd }) {
  if (!Number.isFinite(pid) || pid === process.pid || pid === process.ppid) return false;
  if (cmd.includes(SELF)) return false; // this guard, or its npm wrapper
  // Must belong to this checkout — other projects' dev servers are none of our
  // business, and killing them would be a genuinely nasty surprise.
  const here = ROOT.replace(/\\/g, "\\").toLowerCase();
  const hay = cmd.toLowerCase();
  if (!hay.includes(path.basename(ROOT).toLowerCase()) && !hay.includes(here)) return false;
  return /next(\.cmd|\.js)?["']?\s+(dev|start)\b/.test(hay) || /[\\/]next[\\/]dist[\\/]bin[\\/]next/.test(hay);
}

function kill(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
    return true;
  } catch {
    return false;
  }
}

const servers = findServers();

if (servers.length === 0) {
  console.log("[dev] no other Next.js server running — starting clean.");
} else {
  console.log(
    `[dev] found ${servers.length} existing Next.js server(s) for this project.\n` +
      "[dev] Two servers sharing .next corrupt each other's chunks, which is what\n" +
      "[dev] produces 404s on main-app.js / layout.css and an unstyled page.\n" +
      "[dev] Stopping them so this one is the only server:",
  );
  for (const s of servers) {
    const ok = kill(s.pid);
    console.log(`[dev]   ${ok ? "stopped" : "could not stop"} pid ${s.pid}`);
  }

  // The directory is already inconsistent; a stale manifest outlives a restart.
  const next = path.join(ROOT, ".next");
  if (existsSync(next)) {
    try {
      rmSync(next, { recursive: true, force: true });
      console.log("[dev]   cleared .next (was written by two servers at once)");
    } catch (err) {
      console.log(`[dev]   could not clear .next: ${err.message}`);
    }
  }
}
