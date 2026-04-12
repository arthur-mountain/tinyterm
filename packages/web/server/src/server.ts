import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import { WebSocketServer } from "ws";
import pty from "node-pty";
import { buildSafeEnv, createRateLimiter, validateMessage } from "./security.js";

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 3001;
const SHELL = process.env["SHELL"] ?? "/bin/zsh";

// Origins allowed to connect — must match the Vite dev server origin.
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const MAX_CONNECTIONS = 2;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_MESSAGES_PER_SECOND = 200;

const AUTH_TOKEN = crypto.randomBytes(32).toString("hex");
const TOKEN_FILE = path.resolve(import.meta.dirname, "../../../../.tinyterm-token");
fs.writeFileSync(TOKEN_FILE, AUTH_TOKEN, { encoding: "utf-8", mode: 0o600 });

function verifyClient(info: {
  origin: string;
  req: IncomingMessage;
}): boolean {
  // Allow non-browser clients (curl, wscat) that send no Origin header.
  if (info.origin && !ALLOWED_ORIGINS.has(info.origin)) return false;
  const url = new URL(info.req.url ?? "", "http://localhost");
  return url.searchParams.get("token") === AUTH_TOKEN;
}

const SAFE_ENV = buildSafeEnv(process.env as Record<string, string | undefined>);

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT, verifyClient });

wss.on("connection", (ws) => {
  // wss.clients already includes this new socket by connection time.
  if (wss.clients.size > MAX_CONNECTIONS) {
    ws.close(1013, "Too many connections");
    return;
  }

  const shell = pty.spawn(SHELL, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    env: SAFE_ENV,
  });

  let idleTimer = setTimeout(() => ws.close(1000, "Idle timeout"), IDLE_TIMEOUT_MS);

  function resetIdleTimer(): void {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => ws.close(1000, "Idle timeout"), IDLE_TIMEOUT_MS);
  }

  const limiter = createRateLimiter(MAX_MESSAGES_PER_SECOND);

  shell.onData((data: string) => {
    ws.send(data);
  });

  shell.onExit(({ exitCode }) => {
    ws.send(`\r\n[Process exited with code ${exitCode}]\r\n`);
    ws.close();
  });

  ws.on("message", (data: unknown) => {
    if (!limiter.allow()) return;
    resetIdleTimer();
    const msg = validateMessage(data);
    if (msg === null) return;
    shell.write(msg);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    shell.kill();
  });

  ws.on("close", () => {
    clearTimeout(idleTimer);
    shell.kill();
  });
});

console.log(`PTY server listening on ws://127.0.0.1:${PORT}`);
