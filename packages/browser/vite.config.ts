import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readToken(): string {
  try {
    return readFileSync(
      resolve(import.meta.dirname, "../../.tinyterm-token"),
      "utf-8",
    ).trim();
  } catch {
    // Server hasn't started yet — token will be empty, connection will be refused.
    return "";
  }
}

export default defineConfig({
  server: {
    port: 5173,
  },
  define: {
    __WS_TOKEN__: JSON.stringify(readToken()),
  },
});
