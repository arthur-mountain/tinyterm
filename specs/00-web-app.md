# Spec: Web App Entry Point

## 目標

建立 `packages/web` 的瀏覽器 entry point，將 `TerminalCore`、`CanvasRenderer`、`WebSocketBridge`
串接成可在瀏覽器中運行的終端機應用，完成端對端驗收閉環。

這是所有後續 spec 的前置條件——沒有 entry point 就無法在瀏覽器中驗收任何功能。

## 現狀 (Current State)

`packages/web` 目前以 library 形式存在（`"main": "./dist/index.js"`），只有：

- `CanvasRenderer` — 繪製 canvas
- `WebSocketBridge` — 連接 WebSocket
- `server.ts` — PTY server（Node.js）

**缺失：**

1. 無 HTML 頁面（無 `<canvas>` 容器）
2. 無 browser entry point（無 `app.ts` 串接各 class）
3. 無 bundler（TypeScript 直接 `tsc` 輸出 ESM 模組，瀏覽器無法直接 import `@tinyterm/core`）
4. 無鍵盤輸入處理
5. 無 resize 事件處理

## 技術選擇

採用 **Vite** 作為 dev server + bundler：

- 支援 TypeScript 零配置
- 支援 pnpm workspace 的本地套件（`@tinyterm/core`）直接 import
- `vite build` 輸出靜態資源，可直接部署

## 實作步驟

### Step 1：安裝 Vite

在 `packages/web/client` 中加入 Vite：

```bash
pnpm --filter @tinyterm/client add -D vite
```

更新 `packages/web/client/package.json` scripts：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:lib": "tsc -b",
    "clean": "rm -rf dist *.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  }
}
```

### Step 2：建立 `public/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TinyTerm</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        background: #1a1a1a;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        overflow: hidden;
      }
      #terminal {
        display: block;
        cursor: text;
      }
    </style>
  </head>
  <body>
    <canvas id="terminal"></canvas>
    <script type="module" src="/src/app.ts"></script>
  </body>
</html>
```

### Step 3：建立 `src/app.ts`

```typescript
import { TerminalCore } from "@tinyterm/core";
import { CanvasRenderer } from "./renderer.js";
import { WebSocketBridge } from "./bridge.js";

const WS_URL = "ws://localhost:3000";
const FONT_FAMILY = "Menlo, Monaco, 'Courier New', monospace";
const FONT_SIZE = 14;

function main(): void {
  const canvas = document.getElementById("terminal") as HTMLCanvasElement;

  const core = new TerminalCore();
  const renderer = new CanvasRenderer(core, {
    canvas,
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE,
  });
  const bridge = new WebSocketBridge(core, { url: WS_URL });

  // 渲染事件：core 解析完 PTY 數據後通知重繪
  core.onRenderRequest(({ startRow, endRow }) => {
    renderer.renderRows(startRow, endRow);
  });

  // 鍵盤輸入轉發給 PTY（由 TerminalCore.onInput 內部透過 xterm 的 onData 處理）
  canvas.addEventListener("keydown", (e: KeyboardEvent) => {
    e.preventDefault();
  });

  // 讓 canvas 可以接收 focus 與鍵盤事件
  canvas.setAttribute("tabindex", "0");
  canvas.focus();

  // resize 同步
  function handleResize(): void {
    // 計算視窗能容納的行列數（以目前 cellWidth/cellHeight 為基準）
    // 暫時固定 80x24，待 spec 03 實作 setSize() 後改為動態計算
    const COLS = 80;
    const ROWS = 24;
    core.resize(COLS, ROWS);
    bridge.resize(COLS, ROWS);
  }

  window.addEventListener("resize", handleResize);

  // 建立 WebSocket 連線
  bridge.connect();
}

main();
```

### Step 4：更新 `WebSocketBridge` 支援 resize 方法

`packages/web/src/bridge.ts` 需新增 `resize()` 方法（與 spec 01 的 Step 3 對齊）：

```typescript
resize(cols: number, rows: number): void {
  this.core.resize(cols, rows);
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({ type: "resize", cols, rows }));
  }
}
```

### Step 5：建立 `vite.config.ts`

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  // Vite 預設使用 index.html 在 public/ 或根目錄
  // 無需額外設定，保持最小配置
  server: {
    port: 5173,
  },
});
```

## 驗收條件

- [ ] `pnpm --filter @tinyterm/client dev` 啟動 Vite dev server，瀏覽器開啟 `http://localhost:5173`
- [ ] 同時啟動 PTY server：`pnpm --filter @tinyterm/server serve`
- [ ] Canvas 顯示於頁面中，點擊後可接收鍵盤輸入
- [ ] 輸入指令（如 `ls`）後，PTY 輸出渲染至 canvas
- [ ] 目前以白字黑底顯示（色彩待 spec 02 實作）
- [ ] 游標位置可見（待 spec 03 實作游標繪製）

## 相依關係

本 spec 完成後，後續 spec 的驗收才有瀏覽器環境可用：

| Spec                | 依賴本 spec 的原因                           |
| ------------------- | -------------------------------------------- |
| 01 PTY Server       | resize 訊息需要 bridge.resize() 觸發才能驗收 |
| 02 Color Extraction | 需要實際 ANSI 輸出渲染到 canvas 才能目視驗收 |
| 03 Canvas Renderer  | 游標、尺寸調整需要完整 app 才能互動測試      |
| 04 Dirty Rectangles | 效能優化需要在真實滾動情境下量測             |
| 05 CJK/Emoji        | 需要能輸入中文字元的終端機環境驗收           |
