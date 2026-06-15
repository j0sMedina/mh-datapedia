# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm@9

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile

# Build shared package (API depends on it)
RUN pnpm --filter @mh-datapedia/shared build

# Generate Prisma client (writes to node_modules/.prisma)
RUN pnpm --filter @mh-datapedia/api exec prisma generate --schema=./prisma/schema.prisma

# Compile TypeScript
RUN pnpm --filter @mh-datapedia/api build

# Create standalone production bundle (prod deps only, workspace packages bundled)
RUN pnpm --filter @mh-datapedia/api deploy --prod /deploy

# pnpm deploy skips gitignored files — copy dist and Prisma client manually
RUN cp -r apps/api/dist /deploy/dist

# With pnpm, Prisma generates the client inside the pnpm virtual store.
# Copy the generated .prisma directory into the deployed bundle so the app can find it.
RUN PRISMA_CLIENT_DIR=$(find node_modules/.pnpm -type d -name ".prisma" 2>/dev/null | head -1) && \
    if [ -n "$PRISMA_CLIENT_DIR" ]; then \
      mkdir -p /deploy/node_modules/.prisma && \
      cp -r "$PRISMA_CLIENT_DIR/." /deploy/node_modules/.prisma/; \
    else \
      echo "Warning: .prisma directory not found, skipping" ; \
    fi

# ── Stage 2: Run ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy the self-contained bundle from builder
COPY --from=builder /deploy .

# Prisma schema needed to run `prisma migrate deploy` at deploy time
COPY --from=builder /app/apps/api/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3001

# Run as non-root for security
USER node

CMD ["node", "dist/index.js"]
