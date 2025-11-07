# ============================================================================

# ENTERPRISE SEARCH SERVICE - QUICK REFERENCE GUIDE

# ============================================================================

## 🚀 QUICK START (5 Minutes)

### Install & Setup

```powershell
# 1. Run installation script
.\install-search-service.ps1

# 2. Start application
npm run start:dev

# 3. Verify health
curl http://localhost:3001/search/health

# 4. Sync products
curl -X POST http://localhost:3001/products/sync/meilisearch
```

---

## 📡 API QUICK REFERENCE

### Search Endpoints

| Endpoint                        | Method | Description              |
| ------------------------------- | ------ | ------------------------ |
| `/products/search`              | GET    | Advanced product search  |
| `/products/search/autocomplete` | GET    | Autocomplete suggestions |
| `/products/search/trending`     | GET    | Trending searches        |
| `/search/metrics`               | GET    | Performance metrics      |
| `/search/health`                | GET    | Health check             |
| `/search/cache/invalidate`      | POST   | Clear cache (admin)      |
| `/search/metrics/reset`         | POST   | Reset metrics (admin)    |

### Quick Examples

```bash
# Basic search
curl "http://localhost:3001/products/search?q=laptop"

# Search with filters
curl "http://localhost:3001/products/search?q=phone&category=Electronics&minPrice=300&maxPrice=800&sortBy=price-asc"

# Autocomplete
curl "http://localhost:3001/products/search/autocomplete?q=lap&limit=5"

# Trending
curl "http://localhost:3001/products/search/trending?limit=10"

# Metrics
curl "http://localhost:3001/search/metrics"

# Health
curl "http://localhost:3001/search/health"
```

---

## 🎛️ CONFIGURATION CHEAT SHEET

### Environment Variables

| Variable                      | Default   | Description               |
| ----------------------------- | --------- | ------------------------- |
| `REDIS_HOST`                  | localhost | Redis server host         |
| `REDIS_PORT`                  | 6379      | Redis server port         |
| `REDIS_PASSWORD`              | -         | Redis password (optional) |
| `CACHE_TTL`                   | 300       | Cache TTL (seconds)       |
| `SEARCH_TIMEOUT_MS`           | 5000      | Query timeout (ms)        |
| `SEARCH_MAX_RESULTS_PER_PAGE` | 100       | Max results per page      |

### Quick Tuning Guide

```bash
# Increase cache duration (for stable data)
CACHE_TTL=600  # 10 minutes

# Decrease cache duration (for frequently changing data)
CACHE_TTL=60   # 1 minute

# Increase max results
SEARCH_MAX_RESULTS_PER_PAGE=200

# Increase timeout for slow queries
SEARCH_TIMEOUT_MS=10000
```

---

## 🔧 REDIS QUICK COMMANDS

### Docker Commands

```powershell
# Start Redis
docker-compose -f docker-compose.redis.yml up -d

# Stop Redis
docker-compose -f docker-compose.redis.yml down

# View logs
docker-compose -f docker-compose.redis.yml logs -f redis

# Restart Redis
docker-compose -f docker-compose.redis.yml restart redis

# Redis stats
docker exec sellr-redis redis-cli INFO stats
```

### Redis CLI Commands

```bash
# Connect to Redis
docker exec -it sellr-redis redis-cli

# Check if Redis is running
redis-cli PING

# Get all keys
redis-cli KEYS '*'

# Get cache stats
redis-cli INFO stats

# Clear all cache
redis-cli FLUSHDB

# Monitor real-time commands
redis-cli MONITOR
```

---

## 📊 MONITORING QUICK CHECKS

### Health Check

```bash
curl http://localhost:3001/search/health | jq
```

Expected output:

```json
{
  "status": "healthy",
  "checks": {
    "meilisearch": "healthy",
    "database": "healthy",
    "cache": "healthy",
    "circuitBreaker": "closed"
  }
}
```

### Performance Metrics

```bash
curl http://localhost:3001/search/metrics | jq '.metrics'
```

**Key Metrics to Monitor:**

- `cacheHitRatio`: Should be > 85%
- `averageLatency`: Should be < 50ms
- `p95Latency`: Should be < 100ms
- `errorCount`: Should be 0 or near 0

---

## 🔥 TROUBLESHOOTING QUICK FIXES

### Issue: Low Cache Hit Ratio

**Check:**

```bash
curl http://localhost:3001/search/metrics | jq '.metrics.cacheHitRatio'
```

**Fix:**

```bash
# Increase cache TTL
# Edit .env: CACHE_TTL=600
```

---

### Issue: High Latency

**Check:**

```bash
curl http://localhost:3001/search/metrics | jq '.metrics.p95Latency'
```

**Fix:**

```bash
# 1. Check MeiliSearch index
curl http://localhost:7700/indexes/products/stats

# 2. Resync if needed
curl -X POST http://localhost:3001/products/sync/meilisearch

# 3. Clear cache
curl -X POST http://localhost:3001/search/cache/invalidate
```

---

### Issue: Redis Connection Failed

**Check:**

```powershell
docker ps | findstr redis
redis-cli PING
```

**Fix:**

```powershell
# Restart Redis
docker-compose -f docker-compose.redis.yml restart redis

# Check logs
docker-compose -f docker-compose.redis.yml logs redis
```

---

### Issue: Circuit Breaker Open

**Check:**

```bash
curl http://localhost:3001/search/health | jq '.checks.circuitBreaker'
```

**Fix:**

```bash
# 1. Check MeiliSearch
curl http://localhost:7700/health

# 2. Check database
# Look at app logs

# 3. Wait for auto-reset (1 minute)
# Or restart app to force reset
```

---

## 🎯 PERFORMANCE OPTIMIZATION TIPS

### Cache Hit Ratio < 85%

- ✅ Increase `CACHE_TTL`
- ✅ Increase `CACHE_MAX_SIZE`
- ✅ Check Redis memory limits

### Latency > 100ms (p95)

- ✅ Optimize MeiliSearch index
- ✅ Add database indexes
- ✅ Increase Redis memory
- ✅ Scale horizontally

### Error Rate > 0.1%

- ✅ Check MeiliSearch health
- ✅ Check database connection pool
- ✅ Review error logs
- ✅ Tune circuit breaker thresholds

---

## 🔄 CACHE MANAGEMENT

### Clear All Cache

```bash
curl -X POST http://localhost:3001/search/cache/invalidate
```

### Warm Up Cache (Pre-populate)

```bash
# Run common searches to populate cache
curl "http://localhost:3001/products/search?q=laptop"
curl "http://localhost:3001/products/search?q=phone"
curl "http://localhost:3001/products/search?category=Electronics"
```

### Monitor Cache Size

```bash
docker exec sellr-redis redis-cli DBSIZE
```

---

## 📈 METRICS DASHBOARD (Manual Check)

```bash
# Get current metrics
METRICS=$(curl -s http://localhost:3001/search/metrics)

echo "=== SEARCH SERVICE METRICS ==="
echo "Total Searches:   $(echo $METRICS | jq -r '.metrics.totalSearches')"
echo "Cache Hit Ratio:  $(echo $METRICS | jq -r '.metrics.cacheHitRatio')"
echo "Avg Latency:      $(echo $METRICS | jq -r '.metrics.averageLatency')ms"
echo "P95 Latency:      $(echo $METRICS | jq -r '.metrics.p95Latency')ms"
echo "Errors:           $(echo $METRICS | jq -r '.metrics.errorCount')"
echo "=============================="
```

---

## 🔐 SECURITY CHECKLIST

- [ ] Set `REDIS_PASSWORD` in production
- [ ] Enable Redis authentication
- [ ] Use HTTPS for API endpoints
- [ ] Add rate limiting middleware
- [ ] Implement admin guards on sensitive endpoints
- [ ] Sanitize user input
- [ ] Enable Redis TLS (production)
- [ ] Use environment-specific configurations

---

## 🚨 PRODUCTION ALERTS

Set up alerts for:

- ❗ Cache hit ratio < 80%
- ❗ P95 latency > 200ms
- ❗ Error rate > 1%
- ❗ Circuit breaker open
- ❗ Redis connection failures
- ❗ Disk space > 80%
- ❗ Memory usage > 80%

---

## 📞 SUPPORT

**Documentation:**

- Full Documentation: `SEARCH_DOCUMENTATION.md`
- Setup Guide: `SEARCH_SETUP_GUIDE.sh`

**Logs Location:**

- Application: `stdout` (Docker logs or console)
- Redis: `docker logs sellr-redis`
- MeiliSearch: MeiliSearch logs

**Need Help?**

1. Check health: `curl http://localhost:3001/search/health`
2. Check metrics: `curl http://localhost:3001/search/metrics`
3. Review logs
4. Check documentation

---

## 🎉 YOU'RE ALL SET!

Your enterprise-grade search service is ready for production!

**Quick Test:**

```bash
curl "http://localhost:3001/products/search?q=test" | jq
```

**Expected Response:**

```json
{
  "products": [...],
  "total": 10,
  "metadata": {
    "executionTimeMs": 35,
    "cacheHit": false,
    "source": "meilisearch"
  }
}
```

🚀 **Happy Searching!**
