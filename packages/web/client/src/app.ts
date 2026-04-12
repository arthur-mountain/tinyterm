import { TerminalCore } from "@tinyterm/core";
import { CanvasRenderer } from "./renderer.js";
import { WebSocketBridge } from "./bridge.js";

// Injected at build time by vite.config.ts from .tinyterm-token.
// Empty string when the server hasn't started yet (connection will be rejected).
declare const __WS_TOKEN__: string;

const WS_URL = "ws://localhost:3001";
const FONT_FAMILY = "Menlo, Monaco, 'Courier New', monospace";
const FONT_SIZE = 14;
const COLS = 80;
const ROWS = 24;

function keyEventToSequence(e: KeyboardEvent): string | null {
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) return e.key;
  if (e.ctrlKey && e.key.length === 1) {
    const code = e.key.toUpperCase().charCodeAt(0) - 64;
    if (code > 0 && code < 32) return String.fromCharCode(code);
  }
  switch (e.key) {
    case "Enter":
      return "\r";
    case "Backspace":
      return "\x7f";
    case "Tab":
      return "\t";
    case "Escape":
      return "\x1b";
    case "ArrowUp":
      return "\x1b[A";
    case "ArrowDown":
      return "\x1b[B";
    case "ArrowRight":
      return "\x1b[C";
    case "ArrowLeft":
      return "\x1b[D";
    case "Home":
      return "\x1b[H";
    case "End":
      return "\x1b[F";
    case "Delete":
      return "\x1b[3~";
    case "PageUp":
      return "\x1b[5~";
    case "PageDown":
      return "\x1b[6~";
    default:
      return null;
  }
}

function main(): void {
  const canvas = document.getElementById("terminal") as HTMLCanvasElement;

  const core = new TerminalCore(COLS, ROWS);
  const renderer = new CanvasRenderer(core, {
    canvas,
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE,
  });
  const bridge = new WebSocketBridge(core, { url: WS_URL, token: __WS_TOKEN__ });

  core.onRenderRequest(({ startRow, endRow }) => {
    renderer.renderRows(startRow, endRow);
  });

  canvas.setAttribute("tabindex", "0");
  canvas.addEventListener("keydown", (e: KeyboardEvent) => {
    e.preventDefault();
    const seq = keyEventToSequence(e);
    if (seq) bridge.send(seq);
  });
  canvas.focus();

  window.addEventListener("resize", () => {
    bridge.resize(COLS, ROWS);
  });

  bridge.connect();
}

main();
