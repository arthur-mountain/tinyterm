# Spec: PTY Server 完整實作

## 目標

完成 `packages/web/src/server.ts` 的 PTY Server，支援 resize 同步與 binary 數據，
使終端機尺寸能與瀏覽器端保持一致。

## 現狀 (Current State)

```
packages/web/src/server.ts
```

目前骨架已具備：
- WebSocketServer 監聽 port 3000
- `pty.spawn()` 啟動 shell
- 雙向數據中繼：`shell.onData → ws.send`、`ws.on("message") → shell.write`
- 連線關閉時 `shell.kill()`

**缺失：**
1. resize 訊息處理（終端尺寸不同步）
2. 訊息格式未定義（目前 raw string，無法區分 data 與 control 訊息）
3. 錯誤處理（shell crash、ws error）
4. 多 client 連線隔離

## 訊息協定設計

Client → Server 使用 JSON 封裝，區分數據與控制訊息：

```typescript
type ClientMessage =
  | { type: "data"; payload: string }
  | { type: "resize"; cols: number; rows: number };
```

Server → Client 傳送 raw string（PTY 輸出直接轉發，不包裝）。

> 選擇 raw string 而非 JSON 的原因：PTY 輸出量大且高頻，避免序列化開銷。

## 實作步驟

### Step 1：定義訊息型別

在 `packages/web/src/server.ts` 頂部加入：

```typescript
type ClientMessage =
  | { type: "data"; payload: string }
  | { type: "resize"; cols: number; rows: number };

function parseMessage(raw: string): ClientMessage | null {
  try {
    return JSON.parse(raw) as ClientMessage;
  } catch {
    return null;
  }
}
```

### Step 2：更新 ws.on("message") 處理

```typescript
ws.on("message", (data: unknown) => {
  const msg = parseMessage(String(data));
  if (!msg) return;

  if (msg.type === "data") {
    shell.write(msg.payload);
  } else if (msg.type === "resize") {
    shell.resize(msg.cols, msg.rows);
  }
});
```

### Step 3：更新 WebSocketBridge 端（客戶端）

`packages/web/src/bridge.ts` 的 `connect()` 需改用新的訊息格式：

```typescript
// 傳送 input
this.core.onInput((data) => {
  this.ws?.send(JSON.stringify({ type: "data", payload: data }));
});

// 傳送 resize（需在 TerminalCore.resize() 時觸發）
resize(cols: number, rows: number): void {
  this.core.resize(cols, rows);
  this.ws?.send(JSON.stringify({ type: "resize", cols, rows }));
}
```

### Step 4：錯誤處理

```typescript
shell.onExit(({ exitCode }) => {
  ws.send(`\r\n[Process exited with code ${exitCode}]\r\n`);
  ws.close();
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err);
  shell.kill();
});
```

## 驗收條件

- [ ] 啟動 server，從瀏覽器 WebSocket 連線後可輸入指令並收到輸出
- [ ] 調整瀏覽器視窗大小後，PTY 尺寸同步（`stty size` 輸出正確）
- [ ] Shell 結束後 WebSocket 正常關閉
