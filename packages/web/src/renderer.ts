import type { ITerminalCore } from "@tinyterm/core";
import type { CellData } from "@tinyterm/core";
import type { IRendererConfig } from "./types.js";

const DEFAULT_FONT_FAMILY = "monospace";
const DEFAULT_FONT_SIZE = 16;

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private cellWidth = 0;
  private cellHeight = 0;
  private fontFamily: string;
  private fontSize: number;

  constructor(
    private core: ITerminalCore,
    config: IRendererConfig,
  ) {
    const ctx = config.canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D rendering context");
    this.ctx = ctx;
    this.fontFamily = config.fontFamily ?? DEFAULT_FONT_FAMILY;
    this.fontSize = config.fontSize ?? DEFAULT_FONT_SIZE;
    this.measureCell();
  }

  private measureCell(): void {
    this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    const metrics = this.ctx.measureText("W");
    this.cellWidth = metrics.width;
    this.cellHeight = this.fontSize * 1.2;
  }

  renderRows(startRow: number, endRow: number): void {
    const chunk = this.core.getBufferChunk({ start: startRow, end: endRow });

    for (let y = 0; y < chunk.length; y++) {
      const row = chunk[y];
      const screenY = (startRow + y) * this.cellHeight;

      for (let x = 0; x < row.length; x++) {
        this.drawCell(row[x], x * this.cellWidth, screenY);
      }
    }
  }

  private drawCell(cell: CellData, x: number, y: number): void {
    this.ctx.fillStyle = cell.bg;
    this.ctx.fillRect(x, y, this.cellWidth, this.cellHeight);

    const weight = cell.bold ? "bold " : "";
    const style = cell.italic ? "italic " : "";
    this.ctx.font = `${weight}${style}${this.fontSize}px ${this.fontFamily}`;
    this.ctx.fillStyle = cell.fg;
    this.ctx.fillText(cell.char, x, y + this.fontSize);
  }
}
