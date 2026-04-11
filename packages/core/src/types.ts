/**
 * Row range for buffer chunk retrieval.
 */
export interface Range {
  start: number;
  end: number;
}

/**
 * Dirty rectangle render event.
 * Tells the UI layer which rows changed and need redrawing.
 */
export interface IRenderEvent {
  startRow: number;
  endRow: number;
}

/**
 * Single character cell data.
 * Represents one cell in the terminal character grid.
 */
export interface CellData {
  char: string;
  fg: string;
  bg: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Core terminal interface.
 * Pure logic layer — no DOM, no platform-specific APIs.
 */
export interface ITerminalCore {
  write(data: string): void;
  onInput(callback: (data: string) => void): void;
  resize(cols: number, rows: number): void;
  getBufferChunk(range: Range): CellData[][];
  onRenderRequest(callback: (event: IRenderEvent) => void): void;
}
