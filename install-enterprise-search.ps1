# ============================================================================
# ENTERPRISE SEARCH UPGRADE - INSTALLATION SCRIPT
# ============================================================================
# This script installs all required dependencies for the enterprise-grade
# search implementation with Redis caching
# ============================================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Enterprise Search Upgrade - Installation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install NestJS Cache Manager
Write-Host "Step 1: Installing @nestjs/cache-manager..." -ForegroundColor Yellow
npm install @nestjs/cache-manager cache-manager

# Step 2: Install Redis Store for Cache Manager
Write-Host "Step 2: Installing cache-manager-redis-store..." -ForegroundColor Yellow
npm install cache-manager-redis-store

# Step 3: Install Redis Client
Write-Host "Step 3: Installing redis..." -ForegroundColor Yellow
npm install redis

# Step 4: Install Types (Dev Dependencies)
Write-Host "Step 4: Installing TypeScript types..." -ForegroundColor Yellow
npm install --save-dev @types/cache-manager @types/cache-manager-redis-store

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ✅ Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Start Redis: docker-compose -f docker-compose.redis.yml up -d" -ForegroundColor Yellow
Write-Host "2. Add environment variables to .env:" -ForegroundColor Yellow
Write-Host "   REDIS_HOST=localhost" -ForegroundColor Gray
Write-Host "   REDIS_PORT=6379" -ForegroundColor Gray
Write-Host "   REDIS_DB=0" -ForegroundColor Gray
Write-Host "   CACHE_TTL=300" -ForegroundColor Gray
Write-Host "3. Restart your NestJS application" -ForegroundColor Yellow
Write-Host "4. Test the search: GET http://localhost:3001/products/search?q=test" -ForegroundColor Yellow
Write-Host "5. View metrics: GET http://localhost:3001/search/metrics" -ForegroundColor Yellow
Write-Host ""
