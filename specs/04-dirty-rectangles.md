# Spec: Dirty Rectangles 局部更新機制

## 目標

將目前 `TerminalCore` 的「全畫面刷新」替換為「僅重繪變動行」，
降低高流量輸出（如 `cat large-file`）時的 Canvas 繪製負擔。

## 現狀 (Current State)

```typescript
// packages/core/src/terminal-core.ts
write(data: string): void {
  this.terminal.write(data, () => {
    // 目前：每次 write 後觸發完整 viewport 刷新
    for (const cb of this.renderCallbacks) {
      cb({ startRow: 0, endRow: this.terminal.rows });
    }
  });
}
```

**問題：** `cat` 輸出一個 10,000 行的檔案時，每次 write chunk 都觸發全畫面重繪。

## 技術分析

`@xterm/headless` 不直接暴露 dirty-row 資訊。需透過 xterm.js 的 **addon 機制**
掛入內部渲染事件，或自行追蹤 cursor 行移動範圍。

### 方案一：自訂 Addon（推薦）

xterm.js 允許透過 `terminal.loadAddon()` 掛入 addon，addon 可存取 `ITerminal`（內部介面），
其中包含 `onRender` 事件（帶有精確的 dirty row range `{ start, end }`）。

```typescript
// packages/core/src/render-tracker-addon.ts
import type { ITerminalAddon, ITerminal } from "@xterm/headless";
import type { IRenderEvent } from "./types.js";

export class RenderTrackerAddon implements ITerminalAddon {
  private callbacks: Array<(event: IRenderEvent) => void> = [];

  activate(terminal: ITerminal): void {
    // ITerminal.onRender 提供精確的 dirty row range
    terminal.onRender(({ start, end }) => {
      for (const cb of this.callbacks) {
        cb({ startRow: start, endRow: end });
      }
    });
  }

  dispose(): void {
    this.callbacks = [];
  }

  onRender(callback: (event: IRenderEvent) => void): void {
    this.callbacks.push(callback);
  }
}
```

在 `TerminalCore` 中使用：

```typescript
import { RenderTrackerAddon } from "./render-tracker-addon.js";

constructor(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
  this.terminal = new Terminal({ cols, rows });
  this.renderAddon = new RenderTrackerAddon();
  this.terminal.loadAddon(this.renderAddon);
}

onRenderRequest(callback: (event: IRenderEvent) => void): void {
  this.renderAddon.onRender(callback);
}

write(data: string): void {
  // 不再需要 write callback，render 由 addon 觸發
  this.terminal.write(data);
}
```

> **注意：** `ITerminal`（內部型別）與 `Terminal`（公開型別）不同。
> 需要在 addon 的 `activate(terminal: ITerminal)` 中使用 `(terminal as unknown as InternalTerminal).onRender`，
> 或確認 `@xterm/headless` 版本是否已將 `onRender` 列入公開 API。

### 方案二：Cursor-based 範圍追蹤（Fallback）

不依賴內部 API，改以 cursor 行作為 dirty range 的估算：

```typescript
write(data: string): void {
  const beforeRow = this.terminal.buffer.active.cursorY;
  this.terminal.write(data, () => {
    const afterRow = this.terminal.buffer.active.cursorY;
    const startRow = Math.min(beforeRow, afterRow);
    const endRow = Math.max(beforeRow, afterRow) + 1;
    for (const cb of this.renderCallbacks) {
      cb({ startRow, endRow });
    }
  });
}
```

**缺點：** 不精確（scroll 時可能漏掉已移出 cursor 位置的行），但比全畫面好。

## 建議實作順序

1. 先確認 `@xterm/headless` v5.5 的 `ITerminalAddon` 與 `ITerminal` 型別是否包含 `onRender`
2. 若有，實作方案一（RenderTrackerAddon）
3. 若無，使用方案二作為過渡，並在升級 xterm 後切換至方案一

## 驗收條件

- [ ] `cat /dev/urandom | head -c 10000 | xxd` 輸出時 FPS 明顯高於全畫面刷新方案
- [ ] 靜止時（無輸入/輸出）不觸發任何 Canvas 繪製
- [ ] `vim` 游標移動時只重繪受影響的行
- [ ] Chrome DevTools Performance 錄製顯示 canvas paint 面積顯著縮小
