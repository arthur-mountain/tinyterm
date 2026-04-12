FROM node:22-slim

# Build dependencies required to compile node-pty native addon on Linux.
# Linux has no prebuilt binaries in node-pty, so compilation is mandatory.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm@10.30.0

# Copy workspace manifests first so pnpm can resolve the workspace graph.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json        ./packages/core/
COPY packages/web/client/package.json  ./packages/web/client/
COPY packages/web/server/package.json  ./packages/web/server/

# Install only server's production deps (node-pty + ws); skips vitest/@types/*.
# node-pty compiles its native addon here for the Linux target.
RUN pnpm install --filter @tinyterm/server --prod --frozen-lockfile

# Copy compiled JS (build TypeScript on host first: pnpm --filter @tinyterm/server build)
COPY packages/web/server/dist ./packages/web/server/dist

WORKDIR /app/packages/web/server

ENV SHELL=/bin/bash \
    PORT=3002 \
    HOST=0.0.0.0 \
    TOKEN_FILE=/workspace/.tinyterm-token

EXPOSE 3002

CMD ["node", "dist/server.js"]
