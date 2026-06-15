# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm@9

WORKDIR /app

# Copy manifests first so install layer is cached when only source changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build shared package (web depends on it for ESM imports)
RUN pnpm --filter @mh-datapedia/shared build

# Build React app — VITE_API_URL is empty so all /api calls are relative
RUN pnpm --filter @mh-datapedia/web build

# ── Stage 2: Run ───────────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy Nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
