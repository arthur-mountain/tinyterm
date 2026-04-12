import type { ITerminalCore } from "@tinyterm/core";
import type { IBridgeConfig } from "./types.js";

export class WebSocketBridge {
  private ws: WebSocket | null = null;

  constructor(
    private core: ITerminalCore,
    private config: IBridgeConfig,
  ) {}

  connect(): void {
    this.ws = new WebSocket(this.config.url);

    this.ws.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        this.core.write(event.data);
      }
    });

    this.core.onInput((data) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(data);
      }
    });
  }

  send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  resize(cols: number, rows: number): void {
    this.core.resize(cols, rows);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
