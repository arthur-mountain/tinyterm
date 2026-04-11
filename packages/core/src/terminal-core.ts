import { Terminal } from "@xterm/headless";
import type { CellData, ITerminalCore, IRenderEvent, Range } from "./types.js";

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

export class TerminalCore implements ITerminalCore {
  private terminal: Terminal;
  private renderCallbacks: Array<(event: IRenderEvent) => void> = [];

  constructor(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    this.terminal = new Terminal({ cols, rows });
  }

  write(data: string): void {
    // Fire render callbacks after xterm finishes parsing the data chunk.
    // The write completion callback guarantees the buffer is up-to-date.
    // TODO: replace full-viewport flush with dirty-rectangle tracking once
    //       the xterm internal render API is exposed or a custom addon is built.
    this.terminal.write(data, () => {
      const event: IRenderEvent = {
        startRow: 0,
        endRow: this.terminal.rows,
      };
      for (const cb of this.renderCallbacks) {
        cb(event);
      }
    });
  }

  onInput(callback: (data: string) => void): void {
    this.terminal.onData(callback);
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
  }

  getBufferChunk(range: Range): CellData[][] {
    const buffer = this.terminal.buffer.active;
    const rows: CellData[][] = [];

    for (let y = range.start; y < range.end; y++) {
      const line = buffer.getLine(y);
      if (!line) continue;
      const row: CellData[] = [];
      for (let x = 0; x < line.length; x++) {
        const cell = line.getCell(x);
        if (!cell) continue;
        row.push({
          char: cell.getChars() || " ",
          // TODO: resolve actual color from cell.getFgColorMode() / getFgColor()
          fg: "#ffffff",
          bg: "#000000",
          bold: cell.isBold() !== 0,
          italic: cell.isItalic() !== 0,
        });
      }
      rows.push(row);
    }

    return rows;
  }

  onRenderRequest(callback: (event: IRenderEvent) => void): void {
    this.renderCallbacks.push(callback);
  }
}
