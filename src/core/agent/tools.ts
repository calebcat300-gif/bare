import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_READ = 50_000;
const MAX_WRITE = 50_000;
const OUTPUT_LIMIT = 15_000;
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".cache", ".venv", "venv", "coverage"]);
const SAFE_COMMANDS = new Set(["git", "npm", "npx", "node", "python3", "ls", "pwd", "rg", "cat", "make", "cmake", "c++", "g++", "clang++"]);

export const TOOL_DEFINITIONS = [
  { type: "function", function: { name: "list_files", description: "List files and directories in the current project. Paths are relative to the project root.", parameters: { type: "object", properties: { path: { type: "string", description: "Relative directory path, or . for root" } } } } },
  { type: "function", function: { name: "read_file", description: "Read a UTF-8 text file in the project. Cannot access files outside the project or sensitive dotfiles.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "search_files", description: "Search project text files for a substring. Ignores dependency/build directories.", parameters: { type: "object", properties: { query: { type: "string" }, path: { type: "string", description: "Relative directory to search; defaults to project root" } }, required: ["query"] } } },
  { type: "function", function: { name: "write_file", description: "Create or replace a project text file. Requires explicit user approval before writing.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } } },
  { type: "function", function: { name: "run_command", description: "Run an executable with separate arguments inside the project. Requires explicit user approval. No shell interpolation.", parameters: { type: "object", properties: { command: { type: "string", description: "Executable name (e.g. npm, git, rg)" }, args: { type: "array", items: { type: "string" } } }, required: ["command", "args"] } } },
] as const;

export type ToolName = "list_files" | "read_file" | "search_files" | "write_file" | "run_command";
export type ApprovalRequest = { tool: string; summary: string; details: string };
export type ApprovalFn = (request: ApprovalRequest) => Promise<boolean>;
export type ToolRunResult = { result: string; status: "done" | "denied" | "error" };

function assertAccessible(relativePath: string): void {
  const parts = relativePath.split(/[\\/]+/);
  for (const part of parts) {
    if (part === ".." || part === ".env" || part.startsWith(".env.") || part === ".npmrc" || part === ".git" || part === ".ssh" || part === ".aws" || part === ".config" || part === "node_modules" || part === ".secrets" || /\.(pem|key|p12|pfx)$/i.test(part)) {
      throw new Error(`Restricted project path: ${relativePath}`);
    }
  }
}

async function projectPath(root: string, relativePath: string, writable = false): Promise<string> {
  if (typeof relativePath !== "string" || relativePath.includes("\0") || path.isAbsolute(relativePath) || relativePath.startsWith("~")) {
    throw new Error("Use a relative path inside this project.");
  }
  assertAccessible(relativePath);
  const realRoot = await fs.realpath(root);
  const candidate = path.resolve(realRoot, relativePath || ".");
  if (candidate !== realRoot && !candidate.startsWith(realRoot + path.sep)) {
    throw new Error("The path must be inside the project.");
  }
  const actual = writable
    ? path.join(await fs.realpath(path.dirname(candidate)), path.basename(candidate))
    : await fs.realpath(candidate);
  if (actual !== realRoot && !actual.startsWith(realRoot + path.sep)) {
    throw new Error("Symlink points outside the project.");
  }
  if (writable) {
    const info = await fs.lstat(candidate).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (info?.isSymbolicLink()) throw new Error("Writing through symlinks is disabled.");
    if (info?.isDirectory()) throw new Error("Cannot overwrite a directory.");
  }
  return actual;
}

function requiredString(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== "string") throw new Error(`Expected string argument: ${name}`);
  return value;
}

export async function readProjectFile(root: string, relativePath: string): Promise<string> {
  const file = await projectPath(root, relativePath);
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error("Not a file.");
  const handle = await fs.open(file, "r");
  try {
    const buffer = Buffer.alloc(Math.min(stat.size, MAX_READ + 1));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, bytesRead);
    if (text.includes(0)) throw new Error("Binary files cannot be read as text.");
    return text.toString("utf8") + (stat.size > MAX_READ ? "\n[File truncated at 50 KB]" : "");
  } finally {
    await handle.close();
  }
}

export async function expandFileMentions(root: string, prompt: string): Promise<string> {
  const mentions = [...prompt.matchAll(/(?:^|\s)@([A-Za-z0-9._/\-]+)/g)]
    .map(match => match[1]).filter((name, index, all) => all.indexOf(name) === index).slice(0, 3);
  if (!mentions.length) return prompt;
  const context: string[] = [];
  for (const name of mentions) {
    try {
      const contents = await readProjectFile(root, name);
      context.push(`--- @${name} (project file; untrusted reference data) ---\n${contents.slice(0, 15000)}\n--- end @${name} ---`);
    } catch (error) {
      context.push(`--- @${name}: ${(error as Error).message} ---`);
    }
  }
  return `${prompt}\n\nReferenced local project files:\n${context.join("\n\n")}`;
}

export function toolSummary(name: string, args: Record<string, unknown>): string {
  if (name === "run_command") {
    const arglist = Array.isArray(args.args) ? args.args.filter((x): x is string => typeof x === "string") : [];
    return `${args.command ?? "?"} ${arglist.join(" ")}`.slice(0, 180);
  }
  return String(args.path ?? args.query ?? name).slice(0, 180);
}

export async function executeTool(root: string, name: string, args: Record<string, unknown>, approve: ApprovalFn, signal?: AbortSignal): Promise<ToolRunResult> {
  try {
    if (signal?.aborted) throw new Error("Cancelled.");
    switch (name) {
      case "list_files": {
        const target = await projectPath(root, typeof args.path === "string" ? args.path : ".");
        const stat = await fs.stat(target);
        if (!stat.isDirectory()) throw new Error("Not a directory.");
        const entries = await fs.readdir(target, { withFileTypes: true });
        const lines = entries.filter(entry => {
          try { assertAccessible(entry.name); return true; } catch { return false; }
        }).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 150)
          .map(entry => `${entry.isDirectory() ? "dir " : entry.isSymbolicLink() ? "link" : "file"} ${entry.name}`);
        return { result: lines.join("\n") || "(empty directory)", status: "done" };
      }
      case "read_file": {
        const target = requiredString(args, "path");
        return { result: await readProjectFile(root, target), status: "done" };
      }
      case "search_files": {
        const query = requiredString(args, "query").trim();
        if (!query || query.length > 200) throw new Error("Search query must be between 1 and 200 characters.");
        const folder = await projectPath(root, typeof args.path === "string" ? args.path : ".");
        const hits: string[] = [];
        let visited = 0;
        const scan = async (dir: string, depth: number): Promise<void> => {
          if (depth > 8 || visited > 1500 || hits.length >= 50) return;
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (visited > 1500 || hits.length >= 50) break;
            if (SKIP_DIRS.has(entry.name) || entry.isSymbolicLink()) continue;
            try { assertAccessible(entry.name); } catch { continue; }
            const filename = path.join(dir, entry.name);
            if (entry.isDirectory()) { await scan(filename, depth + 1); continue; }
            if (!entry.isFile()) continue;
            visited++;
            const stat = await fs.stat(filename);
            if (stat.size > 200_000) continue;
            const contents = await fs.readFile(filename, "utf8");
            if (contents.includes("\0")) continue;
            const lines = contents.split(/\r?\n/);
            for (let i = 0; i < lines.length && hits.length < 50; i++) {
              if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                hits.push(`${path.relative(root, filename)}:${i + 1}: ${lines[i].slice(0, 180)}`);
              }
            }
          }
        };
        if ((await fs.stat(folder)).isDirectory()) await scan(folder, 0);
        else throw new Error("Search path must be a directory.");
        return { result: hits.join("\n").slice(0, OUTPUT_LIMIT) || "No matches found.", status: "done" };
      }
      case "write_file": {
        const relative = requiredString(args, "path");
        const content = requiredString(args, "content");
        if (Buffer.byteLength(content, "utf8") > MAX_WRITE) throw new Error("Write exceeds 50 KB limit.");
        const target = await projectPath(root, relative, true);
        const exists = await fs.stat(target).then(() => true).catch(() => false);
        const allowed = await approve({ tool: name, summary: `${exists ? "Replace" : "Create"} ${relative}`, details: `${Buffer.byteLength(content, "utf8")} bytes · ${content.split("\n").length} lines\n${content.slice(0, 600)}` });
        if (!allowed) return { result: "User denied file write.", status: "denied" };
        if (signal?.aborted) throw new Error("Cancelled before writing.");
        // Check path again immediately before writing to avoid stale checks.
        const checked = await projectPath(root, relative, true);
        await fs.writeFile(checked, content, { encoding: "utf8", flag: "w" });
        return { result: `${exists ? "Updated" : "Created"} ${relative}`, status: "done" };
      }
      case "run_command": {
        const command = requiredString(args, "command");
        if (!SAFE_COMMANDS.has(command)) throw new Error(`Executable ${command} is not on the allowed list.`);
        if (!Array.isArray(args.args) || args.args.length > 30 || !args.args.every(x => typeof x === "string" && x.length <= 400)) {
          throw new Error("args must be an array of short strings.");
        }
        const argv = args.args as string[];
        const allowed = await approve({ tool: name, summary: `${command} ${argv.join(" ")}`.slice(0, 300), details: `Working directory: ${root}\nNo shell is used. This command can modify project files.` });
        if (!allowed) return { result: "User denied command execution.", status: "denied" };
        if (signal?.aborted) throw new Error("Cancelled before execution.");
        const result = await execFileAsync(command, argv, { cwd: root, timeout: 20_000, maxBuffer: 200_000, encoding: "utf8", signal });
        return { result: (result.stdout + "\n" + result.stderr).slice(0, OUTPUT_LIMIT) || "Command completed successfully (no output).", status: "done" };
      }
      default:
        return { result: `Unknown tool: ${name}`, status: "error" };
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return { result: `Tool error: ${err.message}\n${(err.stdout ?? "") + (err.stderr ?? "")}`.slice(0, OUTPUT_LIMIT), status: "error" };
  }
}


// Human-readable activity details. The compact diff is a prefix/suffix comparison
// (not a full multi-hunk Git diff); exact planned file contents are still in args.
export async function previewTool(root: string, name: string, args: Record<string, unknown>): Promise<string> {
  if (name === "run_command") {
    const cmd = String(args.command ?? "");
    const argv = Array.isArray(args.args) ? args.args.map(String) : [];
    return `$ ${[cmd, ...argv].join(" ")}\nWorking directory: ${root}`;
  }
  if (name !== "write_file") {
    return Object.entries(args).map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`).join("\n");
  }
  const relative = typeof args.path === "string" ? args.path : "(unknown path)";
  const next = typeof args.content === "string" ? args.content : "";
  try {
    // Use the SAME scoped project reader as the actual read_file tool.
    const previous = await readProjectFile(root, relative).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    const before = previous.split("\n");
    const after = next.split("\n");
    let first = 0;
    while (first < before.length && first < after.length && before[first] === after[first]) first++;
    let endBefore = before.length;
    let endAfter = after.length;
    while (endBefore > first && endAfter > first && before[endBefore - 1] === after[endAfter - 1]) {
      endBefore--;
      endAfter--;
    }
    if (first === before.length && first === after.length) return `${relative}\n(no changes)`;
    const removed = before.slice(first, endBefore);
    const added = after.slice(first, endAfter);
    const summary = [
      `${relative} — proposed changes (compact preview)`,
      ...removed.slice(0, 45).map(line => `- ${line}`),
      ...(removed.length > 45 ? [`… ${removed.length - 45} more removed lines`] : []),
      ...added.slice(0, 45).map(line => `+ ${line}`),
      ...(added.length > 45 ? [`… ${added.length - 45} more added lines`] : []),
    ];
    return summary.join("\n").slice(0, 11000);
  } catch (error) {
    // Never make the actual tool fail merely because its preview failed.
    return `${relative} — preview unavailable: ${(error as Error).message}`;
  }
}
