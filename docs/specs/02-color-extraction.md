# Spec: xterm 色彩提取

## 目標

實作 `packages/core/src/terminal-core.ts` 中 `getBufferChunk()` 的色彩解析，
將 `@xterm/headless` 的 `IBufferCell` 色彩資訊轉換為 `CellData.fg / bg`（HEX 字串）。

## 現狀 (Current State)

```typescript
// packages/core/src/terminal-core.ts — getBufferChunk()
row.push({
  char: cell.getChars() || " ",
  fg: "#ffffff",  // 硬編碼，待實作
  bg: "#000000",  // 硬編碼，待實作
  bold: cell.isBold() !== 0,
  italic: cell.isItalic() !== 0,
});
```

## xterm.js 色彩模式

xterm.js 的 `IBufferCell` 使用三種色彩模式（`ColorMode` enum）：

| Mode | 值 | 說明 |
|---|---|---|
| `DEFAULT` | 0 | 使用終端預設色（fg: white, bg: black） |
| `PALETTE_256` | 2 | 256 色 palette，`getFgColor()` 回傳 0–255 的 index |
| `RGB` | 3 | 24-bit True Color，`getFgColor()` 回傳 packed integer `0xRRGGBB` |

> `ColorMode` 未直接由 `@xterm/headless` 公開導出，需使用數字常數比對。

## 實作

### 新增 `packages/core/src/color.ts`

```typescript
const COLOR_MODE_DEFAULT = 0;
const COLOR_MODE_PALETTE = 2;
const COLOR_MODE_RGB = 3;

// xterm.js 預設 256 色 palette（terminal default colors）
// 前 16 色為標準 ANSI 色；16–231 為 6x6x6 color cube；232–255 為灰階
const PALETTE_256: string[] = buildPalette();

function buildPalette(): string[] {
  const palette: string[] = [];

  // 標準 16 色
  const ansi16 = [
    "#000000", "#cc0000", "#4e9a06", "#c4a000",
    "#3465a4", "#75507b", "#06989a", "#d3d7cf",
    "#555753", "#ef2929", "#8ae234", "#fce94f",
    "#729fcf", "#ad7fa8", "#34e2e2", "#eeeeec",
  ];
  palette.push(...ansi16);

  // 6x6x6 color cube (index 16–231)
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        const rv = r === 0 ? 0 : 55 + r * 40;
        const gv = g === 0 ? 0 : 55 + g * 40;
        const bv = b === 0 ? 0 : 55 + b * 40;
        palette.push(toHex(rv, gv, bv));
      }
    }
  }

  // 灰階 (index 232–255)
  for (let i = 0; i < 24; i++) {
    const v = 8 + i * 10;
    palette.push(toHex(v, v, v));
  }

  return palette;
}

function toHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function resolveColor(mode: number, value: number, isDefault: string): string {
  if (mode === COLOR_MODE_DEFAULT) return isDefault;
  if (mode === COLOR_MODE_PALETTE) return PALETTE_256[value] ?? isDefault;
  if (mode === COLOR_MODE_RGB) {
    const r = (value >> 16) & 0xff;
    const g = (value >> 8) & 0xff;
    const b = value & 0xff;
    return toHex(r, g, b);
  }
  return isDefault;
}
```

### 更新 `terminal-core.ts`

```typescript
import { resolveColor } from "./color.js";

// 在 getBufferChunk() 內：
row.push({
  char: cell.getChars() || " ",
  fg: resolveColor(cell.getFgColorMode(), cell.getFgColor(), "#ffffff"),
  bg: resolveColor(cell.getBgColorMode(), cell.getBgColor(), "#000000"),
  bold: cell.isBold() !== 0,
  italic: cell.isItalic() !== 0,
});
```

### 更新 `packages/core/src/index.ts`

```typescript
export { resolveColor } from "./color.js";
```

## 驗收條件

- [ ] `cat` 一個含 ANSI 色彩的檔案（如 `ls --color`），顏色正確顯示
- [ ] `htop` / `vim` 等 256 色應用程式色彩正確
- [ ] True Color（24-bit）應用程式（如 `neofetch`）色彩正確
- [ ] `resolveColor` 單元測試涵蓋三種 mode
