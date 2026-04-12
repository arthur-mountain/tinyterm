const ENV_WHITELIST = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "EDITOR",
  "VISUAL",
  "COLORTERM",
] as const;

const MAX_MESSAGE_SIZE = 64 * 1024; // 64 KB — generous for paste, blocks runaway data

export function buildSafeEnv(
  env: Record<string, string | undefined>,
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const key of ENV_WHITELIST) {
    const val = env[key];
    if (val !== undefined) safe[key] = val;
  }
  return safe;
}

export function createRateLimiter(maxPerSecond: number): { allow: () => boolean } {
  let count = 0;
  let windowStart = Date.now();
  return {
    allow(): boolean {
      const now = Date.now();
      if (now - windowStart >= 1000) {
        count = 0;
        windowStart = now;
      }
      count++;
      return count <= maxPerSecond;
    },
  };
}

export function validateMessage(raw: unknown): string | null {
  const str = String(raw);
  if (str.length > MAX_MESSAGE_SIZE) return null;
  return str;
}
