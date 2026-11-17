# Multi-Stage Production Dockerfile for DeBro Backend Engine
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace and package manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/types/tsconfig.json ./packages/types/
COPY packages/types/src/ ./packages/types/src/
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/tsconfig.json ./apps/backend/

# Install dependencies and build shared types
RUN npm ci
RUN npm run build:types

# Copy backend source and compile TypeScript
COPY apps/backend/src/ ./apps/backend/src/
RUN npm run build:backend

# Production Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9000

# Install dumb-init for proper PID 1 signal forwarding
RUN apk add --no-cache dumb-init curl

# Create unprivileged application user
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D debro

# Copy built artifacts and runtime dependencies
COPY --from=builder --chown=debro:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=debro:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=debro:nodejs /app/apps/backend/package.json ./apps/backend/package.json

USER debro
EXPOSE 9000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:9000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/backend/dist/index.js"]
