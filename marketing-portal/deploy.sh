#!/usr/bin/env bash
# ════════════════════════════════════════════════════════
#  NFEGlobal CORE — MARKETING PORTAL — Deploy Script
#  Standalone deployment — zero impact on main core app
#
#  Usage:
#    chmod +x deploy.sh
#    ./deploy.sh            # deploy with defaults
#    ./deploy.sh --ssl      # issue SSL cert first
# ════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[1;33m'
CYN='\033[0;36m'
NC='\033[0m'

DOMAIN="${MARKETING_DOMAIN:-promo.nfeglobal.online}"
COMPOSE_FILE="docker-compose.yml"

echo -e "${CYN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║  NFEGlobal CORE — Marketing Portal Deploy  ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ── Preflight ─────────────────────────────────────────
echo -e "${YLW}[1/5] Preflight checks...${NC}"
command -v docker   >/dev/null 2>&1 || { echo -e "${RED}✗ Docker not found${NC}"; exit 1; }
command -v docker   compose version >/dev/null 2>&1 || { echo -e "${RED}✗ Docker Compose v2 not found${NC}"; exit 1; }

if [ ! -f ".env" ]; then
  echo -e "${YLW}  ⚠  No .env found — copying from .env.example${NC}"
  cp .env.example .env
  echo -e "${RED}  ✗ Please edit .env with your values and re-run.${NC}"
  exit 1
fi
echo -e "${GRN}  ✓ Preflight OK${NC}"

# ── SSL Certificate ───────────────────────────────────
if [[ "$1" == "--ssl" ]]; then
  echo -e "${YLW}[2/5] Issuing SSL certificate for ${DOMAIN}...${NC}"
  docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v /var/www/certbot:/var/www/certbot \
    -p 80:80 \
    certbot/certbot certonly \
      --standalone \
      --non-interactive \
      --agree-tos \
      --email admin@nfeglobal.online \
      -d "${DOMAIN}" \
      -d "www.${DOMAIN}"
  echo -e "${GRN}  ✓ SSL issued${NC}"
else
  echo -e "${YLW}[2/5] Skipping SSL (pass --ssl to issue)${NC}"
fi

# ── Pull latest / Build ───────────────────────────────
echo -e "${YLW}[3/5] Building marketing portal image...${NC}"
docker compose -f "$COMPOSE_FILE" build --no-cache marketing
echo -e "${GRN}  ✓ Build complete${NC}"

# ── Stop old containers ───────────────────────────────
echo -e "${YLW}[4/5] Restarting services...${NC}"
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d
echo -e "${GRN}  ✓ Services started${NC}"

# ── Health Check ──────────────────────────────────────
echo -e "${YLW}[5/5] Health check...${NC}"
sleep 5
HTTP_PORT="${MARKETING_HTTP_PORT:-8080}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${HTTP_PORT}/health 2>/dev/null || echo "000")
if [ "$STATUS" = "200" ]; then
  echo -e "${GRN}  ✓ Health check passed (HTTP ${STATUS})${NC}"
else
  echo -e "${RED}  ✗ Health check returned ${STATUS} — check logs:${NC}"
  echo -e "    docker compose logs marketing"
fi

echo -e ""
echo -e "${GRN}════════════════════════════════════════${NC}"
echo -e "${GRN}  ✅  Marketing Portal deployed!         ${NC}"
echo -e "${GRN}      http://localhost:${HTTP_PORT}       ${NC}"
echo -e "${GRN}      https://${DOMAIN}                  ${NC}"
echo -e "${GRN}════════════════════════════════════════${NC}"
