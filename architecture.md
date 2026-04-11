# 架構文件

## 💡 核心介面構思 (Core Interface Design)

為了實現「核心邏輯 Pure」且能被 Web/Desktop 共用，需要設計了一個 Push-based 的介面。這種模式效能較好，因為 Core 會主動告訴 UI 哪裡需要重繪。

> [!IMPORTANT] 此為初步構思，尚未定案，需近一步評估與判斷

```typescript
/**
 * TerminalCore Interface
 * 負責處理 PTY 原始數據並維護狀態，不涉及任何 DOM 操作
 */ interface ITerminalCore {
  // 1. 數據輸入輸出
  write(data: string): void; // 接收來自 PTY 的原始數據 (ANSI code)
  onInput(callback: (data: string) => void): void; // 監聽用戶輸入，準備傳回 PTY

  // 2. 狀態管理
  resize(cols: number, rows: number): void;
  getBufferChunk(range: Range): CellData[][]; // 供初次渲染或全量更新使用

  // 3. 渲染橋接 (核心優化關鍵)
  // 當 xterm.js 解析完數據，觸發此回調告訴 UI 哪些區域變動了
  onRenderRequest(callback: (event: IRenderEvent) => void): void;
}
/**
 * 局部更新事件定義 (Dirty Rectangles)
 */ interface IRenderEvent {
  startRow: number;
  endRow: number;
  // 讓 UI 知道只需要重繪這幾行，不需要清空整個 Canvas
}
/**
 * 單一字元單元格數據
 */ interface CellData {
  char: string;
  fg: string; // 前景色 (HEX/RGB)
  bg: string; // 背景色
  bold: boolean;
  italic: boolean;
  // ... 其他樣式屬性
}
```

## 為什麼這樣設計？

1.  解耦 (Decoupling)： ITerminalCore 不知道 Canvas 的存在，它只負責管理 CellData 矩陣。
2.  效能： 透過 onRenderRequest 傳遞變動範圍（Dirty Range），Web Provider 收到後，只需要跑一個小循環去重繪那幾行 Canvas，這在顯示大檔案（如 cat 大檔案）時會非常流暢。
3.  移植性： 到了 Desktop 版，只需要實作一個新的 DesktopProvider 去實作 onInput 的轉發與 onRenderRequest 的接收即可。
