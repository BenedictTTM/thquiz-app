/**
 * ============================================================================
 * INSTALLATION & SETUP GUIDE
 * ============================================================================
 * Enterprise Search Service - Production Deployment
 * ============================================================================
 */

# STEP 1: Install Required Dependencies
# ============================================================================

npm install @nestjs/cache-manager cache-manager cache-manager-redis-store redis

# Or with yarn:
yarn add @nestjs/cache-manager cache-manager cache-manager-redis-store redis

# Install type definitions
npm install --save-dev @types/cache-manager @types/cache-manager-redis-store


# STEP 2: Start Redis Server
# ============================================================================

# Option A: Using Docker Compose (Recommended for production)
docker-compose -f docker-compose.redis.yml up -d

# Option B: Using local Redis installation
# Windows (via Chocolatey):
choco install redis-64
redis-server

# Linux:
sudo apt-get install redis-server
sudo systemctl start redis

# macOS (via Homebrew):
brew install redis
brew services start redis

# Verify Redis is running:
redis-cli ping
# Should return: PONG


# STEP 3: Environment Configuration
# ============================================================================

# Copy example environment file
cp .env.search.example .env

# Edit .env and configure:
# - REDIS_HOST=localhost
# - REDIS_PORT=6379
# - REDIS_PASSWORD= (if using authentication)
# - CACHE_TTL=300
# - MEILI_HOST=http://localhost:7700
# - MEILI_ADMIN_KEY=your-master-key


# STEP 4: Update App Module
# ============================================================================

# Add CacheConfigModule to your app.module.ts imports:
# 
# import { CacheConfigModule } from './cache/cache.module';
# 
# @Module({
#   imports: [
#     ConfigModule.forRoot({ isGlobal: true }),
#     CacheConfigModule, // <-- Add this
#     ProductModule,
#     // ... other modules
#   ],
# })


# STEP 5: Verify Installation
# ============================================================================

# Start your NestJS application
npm run start:dev

# Check logs for:
# ✅ "Redis cache connected successfully"
# ✅ "Enterprise Search Service initialized"
# ✅ "MeiliSearch fully initialized and optimized for production"


# STEP 6: Test the Endpoints
# ============================================================================

# Health check
curl http://localhost:3001/search/health

# Metrics
curl http://localhost:3001/search/metrics

# Search (using V2 service)
curl "http://localhost:3001/products/search?q=laptop"

# Cache statistics
curl http://localhost:3001/search/metrics


# STEP 7: Sync Products to MeiliSearch
# ============================================================================

# Initial sync (run once)
curl -X POST http://localhost:3001/products/sync/meilisearch

# Verify sync
curl http://localhost:3001/products/search/stats


# STEP 8: Monitor Performance
# ============================================================================

# View real-time metrics (updates every 5 minutes in logs)
# Check application logs for:
# - Total Searches
# - Cache Hit Ratio
# - Average Latency
# - P95 Latency
# - Error Count

# Access Redis Commander (Web UI for Redis)
http://localhost:8081


# STEP 9: Production Checklist
# ============================================================================

✅ Redis configured with persistence (AOF + RDB)
✅ Redis password set (REDIS_PASSWORD in .env)
✅ Cache TTL configured based on data volatility
✅ MeiliSearch running and accessible
✅ Health check endpoint accessible
✅ Metrics endpoint accessible
✅ Circuit breaker thresholds tuned
✅ Logging level set appropriately
✅ Redis memory limit configured (maxmemory)
✅ Redis eviction policy set (allkeys-lru)
✅ Monitoring/alerting configured
✅ Backup strategy for Redis data


# STEP 10: Troubleshooting
# ============================================================================

# If Redis connection fails:
# Check Redis is running:
redis-cli ping

# Check Redis logs:
docker-compose -f docker-compose.redis.yml logs -f redis

# If search is slow:
# Check cache hit ratio:
curl http://localhost:3001/search/metrics

# If cache hit ratio is low (<85%), increase CACHE_TTL

# If MeiliSearch fails:
# Check MeiliSearch is running:
curl http://localhost:7700/health

# Resync products:
curl -X POST http://localhost:3001/products/sync/meilisearch


# ============================================================================
# MIGRATION FROM V1 TO V2
# ============================================================================

# The new V2 service is backward compatible. Migration steps:

# 1. Install dependencies (see STEP 1)
# 2. Start Redis (see STEP 2)
# 3. Both V1 and V2 run side-by-side
# 4. Gradually switch controller to use SearchProductsServiceV2
# 5. Monitor metrics and performance
# 6. Once stable, deprecate V1


# ============================================================================
# PERFORMANCE OPTIMIZATION TIPS
# ============================================================================

# 1. Tune cache TTL based on data change frequency
# 2. Monitor cache hit ratio (target: >85%)
# 3. Adjust Redis maxmemory based on dataset size
# 4. Use Redis persistence for cache warmup on restart
# 5. Monitor p95 latency (target: <100ms)
# 6. Scale Redis horizontally with Redis Cluster if needed
# 7. Use connection pooling for database queries
# 8. Enable query result streaming for large datasets


# ============================================================================
# MONITORING & ALERTING
# ============================================================================

# Set up alerts for:
# - Cache hit ratio < 80%
# - P95 latency > 200ms
# - Error rate > 1%
# - Circuit breaker open
# - Redis connection failures
# - MeiliSearch unavailable

# Integrate with:
# - Prometheus (metrics scraping)
# - Grafana (dashboards)
# - DataDog (APM)
# - CloudWatch (AWS)
# - New Relic (APM)


# ============================================================================
# DONE! 🎉
# ============================================================================

echo "Enterprise Search Service is ready for production!"
