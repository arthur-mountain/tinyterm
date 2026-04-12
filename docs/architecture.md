# 架構文件

## 💡 核心介面設計 (Core Interface Design)

為了實現「核心邏輯 Pure」且能被 Web/Desktop 共用，設計了一個 Push-based 的介面。這種模式效能較好，因為 Core 會主動告訴 UI 哪裡需要重繪。

> [!NOTE] 介面已定案並實作於 `packages/core/src/types.ts`

```typescript
/**
 * TerminalCore Interface
 * 負責處理 PTY 原始數據並維護狀態，不涉及任何 DOM 操作
 */
interface ITerminalCore {
  // 1. 數據輸入輸出
  write(data: string): void;            // 接收來自 PTY 的原始數據 (ANSI code)
  onInput(callback: (data: string) => void): void; // 監聽用戶輸入，準備傳回 PTY

  // 2. 狀態管理
  resize(cols: number, rows: number): void;
  getBufferChunk(range: Range): CellData[][];  // 供初次渲染或全量更新使用

  // 3. 渲染橋接 (核心優化關鍵)
  // 當 xterm.js 解析完數據，觸發此回調告訴 UI 哪些區域變動了
  onRenderRequest(callback: (event: IRenderEvent) => void): void;
}

interface IRenderEvent {
  startRow: number;
  endRow: number;
}

interface CellData {
  char: string;
  fg: string;   // 前景色 (HEX/RGB)
  bg: string;   // 背景色
  bold: boolean;
  italic: boolean;
  // ... 其他樣式屬性
}
```

## 實作說明 (Implementation Notes)

### onRenderRequest 的實作策略

`@xterm/headless` 不直接暴露 `onRender` 事件（該事件僅存在於完整的 xterm.js DOM 版本）。
目前的實作採用 `write()` completion callback 作為替代：

```typescript
// packages/core/src/terminal-core.ts
write(data: string): void {
  this.terminal.write(data, () => {
    // xterm 解析完成後，通知所有監聽者
    // 目前傳遞完整 viewport 範圍（全畫面刷新）
    // TODO: 未來以自定義 addon 實作真正的 dirty-rectangle 追蹤
    for (const cb of this.renderCallbacks) {
      cb({ startRow: 0, endRow: this.terminal.rows });
    }
  });
}
```

**目前限制：** 每次 `write()` 後都會觸發完整畫面刷新，效能低於 dirty-rectangle 方案。
**規格文件：** 見 `docs/specs/04-dirty-rectangles.md`

### CellData 色彩提取

目前 `getBufferChunk` 回傳硬編碼顏色（`#ffffff` / `#000000`）。
xterm.js 的 `IBufferCell` 需要透過色彩模式判斷才能取得正確顏色：

```typescript
// 未來需實作的色彩解析邏輯
const fgMode = cell.getFgColorMode(); // ColorMode.DEFAULT | PALETTE_256 | RGB
if (fgMode === ColorMode.RGB) {
  const color = cell.getFgColor(); // 24-bit packed integer
  fg = `#${color.toString(16).padStart(6, "0")}`;
}
```

**規格文件：** 見 `docs/specs/02-color-extraction.md`

## 為什麼這樣設計？

1. **解耦 (Decoupling)：** `ITerminalCore` 不知道 Canvas 的存在，它只負責管理 CellData 矩陣。
2. **效能：** 透過 `onRenderRequest` 傳遞變動範圍（Dirty Range），Web Provider 收到後，只需要跑一個小循環去重繪那幾行 Canvas，這在顯示大檔案（如 `cat` 大檔案）時會非常流暢。
3. **移植性：** 到了 Desktop 版，只需要實作一個新的 `DesktopProvider` 去實作 `onInput` 的轉發與 `onRenderRequest` 的接收即可。
