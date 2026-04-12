# Spec: Canvas 渲染器完整實作

## 目標

完成 `packages/web/src/renderer.ts` 的 `CanvasRenderer`，加入游標繪製、
精確字型度量，以及完整的初次渲染（full render）流程。

## 現狀 (Current State)

```
packages/web/src/renderer.ts
```

目前骨架已具備：

- `measureCell()` — 用 `measureText("W")` 估算等寬字型的格寬（不精確）
- `renderRows(startRow, endRow)` — 逐格繪製背景色 + 字元
- `drawCell()` — 分別應用 bold/italic 字型樣式

**缺失：**

1. 游標繪製（目前完全沒有游標）
2. 全畫面初次渲染入口（連線後第一次渲染整個 viewport）
3. Canvas 尺寸未根據終端行列數動態設定
4. `measureText("W")` 對 CJK 字元不正確（CJK 是兩倍寬）

## 實作步驟

### Step 1：動態設定 Canvas 尺寸

在 `CanvasRenderer` constructor 加入：

```typescript
setSize(cols: number, rows: number): void {
  this.canvas.width = cols * this.cellWidth;
  this.canvas.height = rows * this.cellHeight;
}
```

在初始化後呼叫：`renderer.setSize(terminal.cols, terminal.rows)`
在 `core.resize()` 後同步呼叫。

### Step 2：全畫面初次渲染

```typescript
renderAll(cols: number, rows: number): void {
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  this.renderRows(0, rows);
}
```

應在 WebSocket 連線建立後、第一筆 PTY 數據到來前呼叫，確保 Canvas 有初始狀態。

### Step 3：游標繪製

`TerminalCore` 需新增取得游標位置的方法：

```typescript
// packages/core/src/types.ts
interface ITerminalCore {
  // ...（現有方法）
  getCursorPosition(): { x: number; y: number };
}

// packages/core/src/terminal-core.ts
getCursorPosition() {
  return {
    x: this.terminal.buffer.active.cursorX,
    y: this.terminal.buffer.active.cursorY,
  };
}
```

`CanvasRenderer` 加入游標繪製：

```typescript
private renderCursor(): void {
  const { x, y } = this.core.getCursorPosition();
  const screenX = x * this.cellWidth;
  const screenY = y * this.cellHeight;

  // Block cursor（可設定為 beam 或 underline）
  this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  this.ctx.fillRect(screenX, screenY, this.cellWidth, this.cellHeight);
}
```

在 `renderRows()` 末尾呼叫 `this.renderCursor()`，確保游標在最上層繪製。

### Step 4：CJK 寬字元感知

目前 `measureCell()` 使用 `measureText("W")` 估算，CJK 字元（如 `中`）實際寬度是兩倍。

暫行方案（先跳過，見 spec 05）：

- 對 CJK 字元以 `cell.getWidth() === 2` 判斷，繪製時佔用雙格寬度
- `cellWidth` 仍以 ASCII 字元為基準

```typescript
private drawCell(cell: CellData, x: number, y: number, width: number): void {
  const actualWidth = this.cellWidth * width;
  this.ctx.fillStyle = cell.bg;
  this.ctx.fillRect(x, y, actualWidth, this.cellHeight);
  // ...
}
```

> `width` 由 `CellData` 新增 `width: 1 | 2` 欄位提供（需同步更新 `types.ts`）

## 驗收條件

- [ ] 連線後 Canvas 顯示正確的行列數尺寸
- [ ] 游標位置隨輸入移動（block cursor）
- [ ] `ls` / `cat` 輸出正確顯示，無字元位移
- [ ] 調整視窗大小後 Canvas 同步縮放
