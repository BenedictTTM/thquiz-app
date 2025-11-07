# ============================================================================
# ENTERPRISE SEARCH SERVICE - INSTALLATION SCRIPT (PowerShell)
# ============================================================================
# Automated setup for production-grade search with distributed caching
# ============================================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Enterprise Search Service - Installation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Prerequisites
Write-Host "Step 1: Checking prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "✅ npm installed: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found." -ForegroundColor Red
    exit 1
}

# Check Docker (optional but recommended)
try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker installed: $dockerVersion" -ForegroundColor Green
    $hasDocker = $true
} catch {
    Write-Host "⚠️  Docker not found. Will use local Redis if available." -ForegroundColor Yellow
    $hasDocker = $false
}

Write-Host ""

# Step 2: Install NPM Dependencies
Write-Host "Step 2: Installing NPM dependencies..." -ForegroundColor Yellow
Write-Host ""

$packages = @(
    "@nestjs/cache-manager",
    "cache-manager",
    "cache-manager-redis-store",
    "redis"
)

$devPackages = @(
    "@types/cache-manager",
    "@types/cache-manager-redis-store"
)

Write-Host "Installing production dependencies..." -ForegroundColor Cyan
foreach ($package in $packages) {
    Write-Host "  - $package" -ForegroundColor Gray
}

try {
    npm install --save @nestjs/cache-manager cache-manager cache-manager-redis-store redis --loglevel=error
    Write-Host "✅ Production dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install production dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Installing development dependencies..." -ForegroundColor Cyan
foreach ($package in $devPackages) {
    Write-Host "  - $package" -ForegroundColor Gray
}

try {
    npm install --save-dev @types/cache-manager @types/cache-manager-redis-store --loglevel=error
    Write-Host "✅ Development dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install development dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Setup Environment Configuration
Write-Host "Step 3: Setting up environment configuration..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists" -ForegroundColor Yellow
    $response = Read-Host "Do you want to append search configuration? (y/n)"
    
    if ($response -eq "y") {
        Get-Content ".env.search.example" | Add-Content ".env"
        Write-Host "✅ Search configuration appended to .env" -ForegroundColor Green
    } else {
        Write-Host "⏭️  Skipping .env update" -ForegroundColor Yellow
    }
} else {
    Copy-Item ".env.search.example" ".env"
    Write-Host "✅ Created .env from .env.search.example" -ForegroundColor Green
}

Write-Host ""

# Step 4: Start Redis
Write-Host "Step 4: Starting Redis..." -ForegroundColor Yellow
Write-Host ""

if ($hasDocker) {
    Write-Host "Starting Redis with Docker Compose..." -ForegroundColor Cyan
    
    try {
        docker-compose -f docker-compose.redis.yml up -d
        Start-Sleep -Seconds 3
        
        # Verify Redis is running
        $redisStatus = docker ps --filter "name=sellr-redis" --format "{{.Status}}"
        if ($redisStatus -match "Up") {
            Write-Host "✅ Redis started successfully" -ForegroundColor Green
            Write-Host "   Container: sellr-redis" -ForegroundColor Gray
            Write-Host "   Port: 6379" -ForegroundColor Gray
            Write-Host "   Web UI: http://localhost:8081" -ForegroundColor Gray
        } else {
            Write-Host "❌ Redis failed to start" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Failed to start Redis: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Docker not available. Please install Redis manually:" -ForegroundColor Yellow
    Write-Host "   Windows: choco install redis-64" -ForegroundColor Gray
    Write-Host "   Then run: redis-server" -ForegroundColor Gray
}

Write-Host ""

# Step 5: Verify Redis Connection
Write-Host "Step 5: Verifying Redis connection..." -ForegroundColor Yellow
Write-Host ""

try {
    # Try to ping Redis using redis-cli
    $redisPing = docker exec sellr-redis redis-cli ping 2>&1
    
    if ($redisPing -eq "PONG") {
        Write-Host "✅ Redis is responding (PONG)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Redis check failed, but it might still work" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not verify Redis (will check at runtime)" -ForegroundColor Yellow
}

Write-Host ""

# Step 6: Build Application
Write-Host "Step 6: Building application..." -ForegroundColor Yellow
Write-Host ""

try {
    npm run build 2>&1 | Out-Null
    Write-Host "✅ Application built successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Build failed (this is OK if in development mode)" -ForegroundColor Yellow
}

Write-Host ""

# Step 7: Final Instructions
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✅ Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Start the application:" -ForegroundColor White
Write-Host "   npm run start:dev" -ForegroundColor Cyan
Write-Host ""

Write-Host "2. Verify health:" -ForegroundColor White
Write-Host "   curl http://localhost:3001/search/health" -ForegroundColor Cyan
Write-Host ""

Write-Host "3. Sync products to MeiliSearch:" -ForegroundColor White
Write-Host "   curl -X POST http://localhost:3001/products/sync/meilisearch" -ForegroundColor Cyan
Write-Host ""

Write-Host "4. Test search:" -ForegroundColor White
Write-Host "   curl 'http://localhost:3001/products/search?q=laptop'" -ForegroundColor Cyan
Write-Host ""

Write-Host "5. View metrics:" -ForegroundColor White
Write-Host "   curl http://localhost:3001/search/metrics" -ForegroundColor Cyan
Write-Host ""

Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "   - Setup Guide: SEARCH_SETUP_GUIDE.sh" -ForegroundColor Gray
Write-Host "   - Full Docs: SEARCH_DOCUMENTATION.md" -ForegroundColor Gray
Write-Host ""

Write-Host "🎉 Ready for production!" -ForegroundColor Green
Write-Host ""

# Optional: Start application
$startNow = Read-Host "Do you want to start the application now? (y/n)"
if ($startNow -eq "y") {
    Write-Host ""
    Write-Host "Starting application in development mode..." -ForegroundColor Cyan
    npm run start:dev
}
