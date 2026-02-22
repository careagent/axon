# Stage 1: Build
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsdown.config.ts ./
COPY src/ src/
COPY data/ data/

RUN pnpm build

# Stage 2: Production
FROM node:22-alpine

RUN addgroup -S axon && adduser -S axon -G axon

WORKDIR /app

COPY --from=build /app/dist/ dist/
COPY --from=build /app/data/ data/
COPY --from=build /app/package.json .

RUN mkdir -p /app/axon-data && chown axon:axon /app/axon-data

USER axon

ENV AXON_PORT=9999
ENV AXON_HOST=0.0.0.0
ENV AXON_DATA_DIR=/app/axon-data

EXPOSE 9999

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:9999/health || exit 1

ENTRYPOINT ["node", "dist/server/standalone.js"]
