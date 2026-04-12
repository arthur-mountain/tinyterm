# Tiny Term

一個基於 TypeScript 的漸進式終端模擬器實驗專案。

核心目標：透過實作 PTY 數據流處理與自定義 Canvas 渲染引擎，深入理解終端機（Terminal）的底層運作原理。

## 專案亮點 (Project Highlights)

- Hybrid 策略： 使用 xterm.js (Headless Mode) 作為穩定狀態機，負責解析複雜的 ANSI 轉義序列。
- 自定義渲染： 捨棄 DOM 渲染，實作高性能 HTML5 Canvas 繪圖引擎，直接操作字元 Buffer。
- 架構分離： 核心邏輯（Core）與平台（Web/Desktop）完全解耦，具備高度可擴展性。

## 系統架構 (System Architecture)

專案採用 Core-Provider 分離架構，確保核心渲染邏輯與底層通訊模式無關。

### 1. 核心邏輯層 (/packages/core)

- Pure Logic: 封裝 xterm.js 處理 Buffer 與 Parser 邏輯。
- Agnostic Interface: 提供標準化 API，不依賴 DOM 或特定的 Node.js API。
- Rendering Optimization: 實作 Dirty Rectangles (局部重繪) 機制，僅針對變動的字元區域進行繪製。

### 2. 表現層 (/packages/web)

- **client** (`@tinyterm/client`): Canvas Grid Rendering、WebSocket Bridge、鍵盤事件處理。
- **server** (`@tinyterm/server`): node-pty + WebSocket Server，橋接 PTY 與瀏覽器，以 Docker 容器運行（解決 macOS node-pty 原生模組隔離問題）。

### 3. 桌面擴充 (Planned: /packages/desktop)

- 預計使用 Tauri/Electron 封裝，將 Web Provider 的渲染邏輯與本地 Rust/Node-PTY IPC 直接串接。

## 專案結構 (Project Structure)

```
tinyterm/
├── packages/
│   ├── core/               # @tinyterm/core — 純邏輯層，平台無關
│   │   └── src/
│   │       ├── types.ts          # ITerminalCore, IRenderEvent, CellData, Range
│   │       ├── terminal-core.ts  # TerminalCore 實作，封裝 @xterm/headless
│   │       └── index.ts
│   └── web/
│       ├── client/             # @tinyterm/client — 瀏覽器表現層
│       │   └── src/
│       │       ├── types.ts          # IRendererConfig, IBridgeConfig
│       │       ├── renderer.ts       # CanvasRenderer — Canvas 字元矩陣渲染
│       │       ├── bridge.ts         # WebSocketBridge — 瀏覽器端 WebSocket 中繼
│       │       └── index.ts
│       └── server/             # @tinyterm/server — Node.js PTY Server
│           ├── Dockerfile        # 編譯 node-pty 原生模組並執行 Server
│           ├── .dockerignore
│           └── src/
│               ├── server.ts         # node-pty + ws PTY Server
│               └── security.ts       # Token 驗證、Rate Limiting、訊息驗證
├── scripts/
│   └── dev.sh              # 一鍵啟動開發環境（Build → Docker → Vite）
├── docs/
│   └── specs/              # 各功能模組的實作規格文件
├── architecture.md         # 核心介面設計文件
├── tsconfig.json           # TypeScript 6.0 base config (nodenext)
└── pnpm-workspace.yaml
```

## 技術棧 (Tech Stack)

- Language: TypeScript 6.0
- Backend: Node.js, node-pty, ws (WebSocket), Docker
- Frontend Logic: xterm.js (Headless) — `@xterm/headless`
- Frontend View: HTML5 Canvas API
- Package Manager: pnpm (workspace monorepo)

## 開發設定 (Development Setup)

**前置需求：** Node.js 22+、pnpm、Docker

```bash
# 安裝依賴
pnpm install

# 一鍵啟動開發環境（推薦）
# 自動執行：TypeScript 編譯 → Docker 建置 → PTY Server → Vite Dev Server
pnpm dev
# 完成後開啟 http://localhost:5173，Ctrl+C 關閉所有服務
```

伺服器以 Docker 容器運行（解決 macOS 上 node-pty quarantine 問題），並透過
`127.0.0.1:3002` 的 WebSocket 提供服務。啟動後 Token 會寫入根目錄的
`.tinyterm-token`（已加入 `.gitignore`），客戶端透過 URL query param 驗證身份。

```bash
# 其他指令
pnpm build       # 編譯所有套件
pnpm typecheck   # 型別檢查
pnpm clean       # 清除編譯產物
```

## 實作進度 (Development Roadmap)

- [x] 初始化 pnpm monorepo 架構與 TypeScript 6.0 設定
- [x] 定義核心介面：`ITerminalCore`, `IRenderEvent`, `CellData`
- [x] 實作 `TerminalCore` 骨架（封裝 `@xterm/headless`，push-based render 通知）
- [x] 實作 `CanvasRenderer` 骨架（Canvas 字元繪製框架）
- [x] 實作 `WebSocketBridge` 骨架（瀏覽器端 WebSocket）
- [x] 建立 Node.js PTY Server 骨架（node-pty + ws）
- [x] PTY Server resize 同步（JSON 控制幀獨立解析，避免噴入 Shell）
- [x] Token 驗證、Rate Limiting、Idle Timeout 安全機制
- [x] Docker 容器化 Server（解決 macOS node-pty native module 問題）
- [ ] PTY binary 傳輸支援
- [ ] 實作正確的 xterm 色彩提取（256色、24-bit RGB）
- [ ] 完成 Canvas 渲染器（游標繪製、字型度量）
- [ ] 效能優化：實作 Dirty Rectangles 局部更新機制
- [ ] 支援 CJK 寬字元與 Emoji 顯示
