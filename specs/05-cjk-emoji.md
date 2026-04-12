# Spec: CJK 寬字元與 Emoji 支援

## 目標

讓 Canvas 渲染器正確顯示佔兩格的 CJK 字元（如 `中`、`文`）與 Emoji（如 `😀`），
避免字元重疊或位移。

## 背景

終端機的字元格是等寬的 grid。CJK 字元與大多數 Emoji 在終端中佔用「兩格」寬度（fullwidth）。
xterm.js 透過 Unicode 規範與 `getWidth()` 回傳每個 cell 的寬度（1 或 2）。

```
┌──┬──┬──┬──┬──┬──┐
│ A│ B│  中  │ C│ D│   ← 中 佔兩格 (width=2)
└──┴──┴──┴──┴──┴──┘
 0  1  2  3  4  5     ← column index
```

## 需要的改動

### 1. `CellData` 新增 `width` 欄位

```typescript
// packages/core/src/types.ts
interface CellData {
  char: string;
  fg: string;
  bg: string;
  bold: boolean;
  italic: boolean;
  width: 1 | 2; // 新增
}
```

### 2. `getBufferChunk()` 填入 `width`

```typescript
// packages/core/src/terminal-core.ts
row.push({
  char: cell.getChars() || " ",
  fg: resolveColor(cell.getFgColorMode(), cell.getFgColor(), "#ffffff"),
  bg: resolveColor(cell.getBgColorMode(), cell.getBgColor(), "#000000"),
  bold: cell.isBold() !== 0,
  italic: cell.isItalic() !== 0,
  width: cell.getWidth() as 1 | 2, // 新增
});
```

> **注意：** xterm.js 對 width=2 的 cell，下一個 index 會是空白的佔位 cell（`getChars()` 回傳 `""`）。
> 渲染時跳過佔位 cell，避免在同一位置繪製兩次。

### 3. `CanvasRenderer` 感知寬度

```typescript
// packages/web/src/renderer.ts
private drawCell(cell: CellData, x: number, y: number): void {
  const actualWidth = this.cellWidth * cell.width;

  this.ctx.fillStyle = cell.bg;
  this.ctx.fillRect(x, y, actualWidth, this.cellHeight);

  if (cell.char === "") return; // 跳過佔位 cell

  const weight = cell.bold ? "bold " : "";
  const style = cell.italic ? "italic " : "";
  this.ctx.font = `${weight}${style}${this.fontSize}px ${this.fontFamily}`;
  this.ctx.fillStyle = cell.fg;
  this.ctx.fillText(cell.char, x, y + this.fontSize);
}
```

### 4. Emoji 字型支援

多數 Emoji 需要 emoji-capable 字型。建議在 `IRendererConfig` 加入 fallback：

```typescript
// packages/web/src/renderer.ts — measureCell() 與 drawCell()
private get fontStack(): string {
  return `${this.fontFamily}, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"`;
}
```

## Unicode Wide Character 判斷

xterm.js 內部使用 `@xterm/addon-unicode11`（或內建 unicode 表）決定字元寬度。
在 headless 模式下，需確保 Unicode addon 已載入：

```typescript
// packages/core/src/terminal-core.ts
import { Unicode11Addon } from "@xterm/addon-unicode11";

constructor(...) {
  this.terminal = new Terminal({ cols, rows });
  const unicode = new Unicode11Addon();
  this.terminal.loadAddon(unicode);
  this.terminal.unicode.activeVersion = "11";
}
```

> 若 `@xterm/addon-unicode11` 未安裝，CJK 寬度判斷可能回退至 Unicode 6，部分字元寬度不正確。

## 驗收條件

- [ ] `echo "中文字"` 輸出不重疊，每個 CJK 字元佔兩格
- [ ] `echo "😀🎉🚀"` Emoji 正確顯示，不被截斷
- [ ] 混合行（`Hello 世界`）字元對齊正確
- [ ] `vim` 開啟含 CJK 內容的檔案，游標位置正確
