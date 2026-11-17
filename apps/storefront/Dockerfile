# Multi-Stage Production Dockerfile for Next.js Storefront
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace and package manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/types/tsconfig.json ./packages/types/
COPY packages/types/src/ ./packages/types/src/
COPY apps/storefront/package.json ./apps/storefront/
COPY apps/storefront/tsconfig.json ./apps/storefront/

RUN npm ci
RUN npm run build:types

# Copy storefront source
COPY apps/storefront/ ./apps/storefront/

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN cd apps/storefront && npm run build

# Production Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache dumb-init curl
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/public ./apps/storefront/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next ./apps/storefront/.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/package.json ./apps/storefront/package.json

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "run", "start", "--prefix", "apps/storefront"]
