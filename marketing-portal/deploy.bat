@echo off
REM ═══════════════════════════════════════════════════════
REM  NFEGlobal CORE — MARKETING PORTAL — Windows Deploy Script
REM  Standalone — zero impact on main core app
REM  Usage: deploy.bat
REM ═══════════════════════════════════════════════════════

echo.
echo  ╔══════════════════════════════════════╗
echo  ║  NFEGlobal CORE — Marketing Portal Deploy  ║
echo  ╚══════════════════════════════════════╝
echo.

REM Check Docker
docker --version >nul 2>&1 || (
  echo [ERROR] Docker not found. Please install Docker Desktop.
  exit /b 1
)

REM Check .env
if not exist ".env" (
  echo [WARN] No .env found - copying from .env.example
  copy .env.example .env
  echo [ACTION] Please edit .env with your values and re-run.
  pause
  exit /b 1
)

echo [1/4] Building marketing portal image...
docker compose -f docker-compose.yml build --no-cache marketing
if %errorlevel% neq 0 (echo [ERROR] Build failed & exit /b 1)
echo [OK] Build complete

echo [2/4] Stopping existing containers...
docker compose -f docker-compose.yml down --remove-orphans 2>nul
echo [OK] Stopped

echo [3/4] Starting services...
docker compose -f docker-compose.yml up -d
if %errorlevel% neq 0 (echo [ERROR] Startup failed & exit /b 1)
echo [OK] Services started

echo [4/4] Waiting for health check...
timeout /t 6 /nobreak >nul
curl -s http://localhost:8080/health >nul 2>&1
if %errorlevel% == 0 (
  echo [OK] Health check passed
) else (
  echo [WARN] Health check pending - run: docker compose logs marketing
)

echo.
echo  ✅  Marketing Portal is running!
echo      Local:   http://localhost:8080
echo      Domain:  https://promo.nfeglobal.online
echo.
pause
