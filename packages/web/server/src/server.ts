import { WebSocketServer } from "ws";
import pty from "node-pty";

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 5173;
const SHELL = process.env["SHELL"] ?? "/bin/zsh";

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });

wss.on("connection", (ws) => {
  const shell = pty.spawn(SHELL, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    env: process.env as Record<string, string>,
  });

  shell.onData((data: string) => {
    ws.send(data);
  });

  ws.on("message", (data: unknown) => {
    shell.write(String(data));
  });

  ws.on("close", () => {
    shell.kill();
  });
});

console.log(`PTY server listening on ws://localhost:${PORT}`);
