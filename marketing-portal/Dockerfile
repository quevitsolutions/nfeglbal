# ════════════════════════════════════════════════════
#  NFEGlobal CORE — MARKETING PORTAL — Dockerfile
#  Standalone — zero coupling with main core app
# ════════════════════════════════════════════════════

# ── Stage 1: Build ──────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Build-time env vars
ARG VITE_APP_URL
ENV VITE_APP_URL=$VITE_APP_URL

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────
FROM nginx:1.25-alpine

# Copy build output
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
