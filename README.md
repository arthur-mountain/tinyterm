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

- Renderer: 實作高效的 Canvas Grid Rendering。
- Bridge: 透過 WebSocket 與後端 PTY Server 同步數據。
- Events: 處理 Web 環境下的鍵盤、滑鼠及縮放事件。

### 3. 桌面擴充 (Planned: /packages/desktop)

- 預計使用 Tauri/Electron 封裝，將 Web Provider 的渲染邏輯與本地 Rust/Node-PTY IPC 直接串接。

## 技術棧 (Tech Stack)

- Language: TypeScript
- Backend: Node.js, node-pty, ws (WebSocket)
- Frontend Logic: xterm.js (Headless)
- Frontend View: HTML5 Canvas API

## 實作進度 (Development Roadmap)

- [ ] 建立 Node.js PTY Server 基礎通訊。
- [ ] 實作 Core Interface 與 Headless xterm.js 整合。
- [ ] 開發 Canvas 字元矩陣渲染器（支援色彩與游標）。
- [ ] 效能挑戰： 實作 Push-based 局部更新機制，優化大流量輸出時的 FPS。
- [ ] 支援 CJK 寬字元與 Emoji 顯示。
