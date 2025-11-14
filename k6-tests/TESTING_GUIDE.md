# Enterprise Load Testing Guide

## 📚 Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Performance Engineering Principles](#performance-engineering-principles)
3. [When to Run Each Test](#when-to-run-each-test)
4. [Interpreting Results](#interpreting-results)
5. [Troubleshooting Performance Issues](#troubleshooting-performance-issues)
6. [Optimization Strategies](#optimization-strategies)
7. [Production Monitoring](#production-monitoring)

## 🎯 Testing Strategy

### The Testing Pyramid for Load Tests

```
                    ┌──────────────┐
                    │   Breakpoint │  Find absolute limits
                    │   Tests      │  (Quarterly)
                    └──────────────┘
                  ┌──────────────────┐
                  │   Soak Tests     │  Long-duration stability
                  │   (2-24 hours)   │  (Monthly)
                  └──────────────────┘
              ┌────────────────────────┐
              │   Stress Tests         │  Beyond capacity
              │   (400+ VUs)           │  (Weekly)
              └────────────────────────┘
          ┌──────────────────────────────┐
          │   Spike Tests                │  Traffic bursts
          │   (Sudden 300+ VUs)          │  (Weekly)
          └──────────────────────────────┘
      ┌────────────────────────────────────┐
      │   Load Tests                       │  Normal traffic
      │   (50-100 VUs)                     │  (Daily)
      └────────────────────────────────────┘
  ┌──────────────────────────────────────────┐
  │   Smoke Tests                            │  Quick validation
  │   (1 VU)                                 │  (Every deployment)
  └──────────────────────────────────────────┘
```

## 🏗️ Performance Engineering Principles

### 1. Know Your Baselines

Before optimizing, establish performance baselines:

```powershell
# Run baseline test
k6 run --env TEST_TYPE=load k6-tests/product-api-load-tests.js

# Record key metrics:
# - p95 response time
# - p99 response time
# - Error rate
# - Requests per second (RPS)
# - Database connection pool usage
```

### 2. The 80/20 Rule

Focus optimization efforts where they matter:

- 80% of response time often comes from 20% of code
- Optimize database queries first
- Then focus on network I/O
- Finally, optimize application logic

### 3. Measure Everything

**What to Monitor:**

- Response times (p50, p95, p99)
- Error rates
- Throughput (RPS)
- CPU usage
- Memory usage
- Database connections
- Cache hit rates
- Network I/O

### 4. Test Incrementally

Never jump straight to stress testing:

```
Step 1: Smoke (1 VU)      → Verify basic functionality
Step 2: Light Load (10 VU) → Check for obvious issues
Step 3: Load (50 VU)       → Validate normal operation
Step 4: Load (100 VU)      → Test peak normal load
Step 5: Stress (200+ VU)   → Find breaking points
```

## 📅 When to Run Each Test

### Smoke Tests (Every Deployment)

**When:**

- Before every deployment
- After every code change
- In CI/CD pipeline

**Purpose:**

- Verify API is functional
- Catch breaking changes
- Quick sanity check

**Command:**

```powershell
k6 run --env TEST_TYPE=smoke k6-tests/product-api-load-tests.js
```

**Expected Duration:** 1 minute

### Load Tests (Daily)

**When:**

- Daily during active development
- Before production deployments
- After infrastructure changes

**Purpose:**

- Validate performance SLOs
- Ensure consistent performance
- Catch performance regressions

**Command:**

```powershell
k6 run --env TEST_TYPE=load k6-tests/product-api-load-tests.js
```

**Expected Duration:** 16 minutes

### Stress Tests (Weekly)

**When:**

- Weekly on staging
- Before major releases
- After database migrations

**Purpose:**

- Find breaking points
- Test error handling
- Validate recovery mechanisms

**Command:**

```powershell
k6 run --env TEST_TYPE=stress k6-tests/product-api-load-tests.js
```

**Expected Duration:** 15 minutes

### Spike Tests (Weekly)

**When:**

- Before flash sales
- Before marketing campaigns
- Weekly resilience testing

**Purpose:**

- Test auto-scaling
- Validate rate limiting
- Check circuit breakers

**Command:**

```powershell
k6 run --env TEST_TYPE=spike k6-tests/product-api-load-tests.js
```

**Expected Duration:** 10.5 minutes

### Soak Tests (Monthly)

**When:**

- Monthly on staging
- Before major releases
- After memory leak fixes

**Purpose:**

- Find memory leaks
- Test connection pool
- Validate long-term stability

**Command:**

```powershell
k6 run --env TEST_TYPE=soak k6-tests/product-api-load-tests.js
```

**Expected Duration:** 2-24 hours

### Breakpoint Tests (Quarterly)

**When:**

- Quarterly capacity planning
- Before infrastructure scaling
- Performance benchmarking

**Purpose:**

- Find absolute limits
- Plan infrastructure
- Set auto-scaling thresholds

**Command:**

```powershell
k6 run --env TEST_TYPE=breakpoint k6-tests/product-api-load-tests.js
```

**Expected Duration:** 12 minutes

## 📊 Interpreting Results

### Understanding Percentiles

**p50 (Median):** 50% of requests faster than this

- Good for understanding "typical" user experience
- Not good for SLOs (hides outliers)

**p95:** 95% of requests faster than this

- **Industry standard for SLOs**
- Balances performance and outliers
- "Most users" experience this or better

**p99:** 99% of requests faster than this

- Critical for user experience
- Catches significant outliers
- Premium user experience threshold

**p99.9:** 99.9% of requests faster than this

- Enterprise SLO standard
- Catches rare but critical issues

### Reading the Output

```
✓ get_all_products_latency avg=52ms  min=12ms  med=45ms  max=280ms  p(90)=75ms  p(95)=89ms  p(99)=135ms
```

**Interpretation:**

- ✅ **avg=52ms**: Average is good
- ✅ **p(95)=89ms**: 95% under 100ms target ✓
- ✅ **p(99)=135ms**: 99% under 150ms target ✓
- ⚠️ **max=280ms**: Some outliers need investigation

### Traffic Light System

#### 🟢 GREEN - Excellent Performance

```
✓ http_req_duration....: avg=45ms   p(95)=85ms   p(99)=120ms
✓ error_rate...........: 0.01%
✓ api_availability.....: 99.99%
```

**Action:** None needed. Document and maintain.

#### 🟡 YELLOW - Acceptable with Warnings

```
✓ http_req_duration....: avg=95ms   p(95)=180ms  p(99)=280ms
⚠ error_rate...........: 0.5%
✓ api_availability.....: 99.5%
```

**Action:**

- Investigate error sources
- Review slow queries
- Plan optimization sprint

#### 🔴 RED - Critical Issues

```
✗ http_req_duration....: avg=450ms  p(95)=1.2s   p(99)=3.5s
✗ error_rate...........: 5.2%
✗ api_availability.....: 94.8%
```

**Action:**

- **DO NOT DEPLOY**
- Emergency performance review
- Investigate database, indexes, queries
- Check resource limits

## 🔧 Troubleshooting Performance Issues

### Issue: High Response Times

**Symptoms:**

```
✗ http_req_duration....: avg=850ms  p(95)=1.5s
```

**Investigation Steps:**

1. **Check Database Queries**

```sql
-- PostgreSQL: Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

2. **Check Missing Indexes**

```sql
-- Check for sequential scans
SELECT schemaname, tablename, seq_scan, seq_tup_read
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 10;
```

3. **Check Connection Pool**

```typescript
// Monitor Prisma connection pool
console.log('Active connections:', prisma._engine._activeRequestsCount);
```

4. **Check N+1 Queries**

- Review Prisma queries for missing `include`/`select`
- Use Prisma query logging

**Solutions:**

- Add database indexes
- Optimize query patterns
- Implement pagination
- Add caching layer
- Use connection pooling

### Issue: High Error Rate

**Symptoms:**

```
✗ error_rate...........: 5.5%
✗ http_req_failed......: 5.5%
```

**Investigation Steps:**

1. **Check Error Types**

```powershell
# Check backend logs
Get-Content logs/error.log | Select-String "500|502|503|504"
```

2. **Check Resource Limits**

```powershell
# Check if hitting connection limits
netstat -an | findstr "3001" | findstr "ESTABLISHED" | Measure-Object
```

3. **Check Database Health**

```sql
-- PostgreSQL: Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;
```

**Solutions:**

- Increase connection pool size
- Add circuit breakers
- Implement retry logic with backoff
- Add rate limiting
- Scale database

### Issue: Memory Leaks (Soak Test)

**Symptoms:**

```
# Memory usage increases over time
Hour 1: 500MB
Hour 2: 850MB
Hour 3: 1.2GB
Hour 4: 1.8GB (CRASH)
```

**Investigation Steps:**

1. **Heap Snapshot Analysis**

```powershell
# Start with Node.js inspector
node --inspect dist/main.js
```

2. **Check Event Listeners**

```typescript
// Check for event listener leaks
process.on('warning', (warning) => {
  if (warning.name === 'MaxListenersExceededWarning') {
    console.error('Memory leak: Too many event listeners');
  }
});
```

3. **Monitor Object Retention**

- Use Chrome DevTools Memory Profiler
- Look for detached DOM nodes
- Check for unclosed connections

**Solutions:**

- Close database connections properly
- Remove event listeners
- Clear caches periodically
- Implement connection timeouts
- Use WeakMap for object caches

## 🚀 Optimization Strategies

### 1. Database Optimization

**Create Indexes:**

```sql
-- Products table indexes
CREATE INDEX idx_products_category ON products(category) WHERE is_active = true;
CREATE INDEX idx_products_user_id ON products(user_id) WHERE is_active = true;
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_price ON products(discounted_price);

-- Composite indexes for common queries
CREATE INDEX idx_products_category_price ON products(category, discounted_price)
  WHERE is_active = true AND is_sold = false;

-- Full-text search index
CREATE INDEX idx_products_search ON products
  USING GIN(to_tsvector('english', title || ' ' || description));
```

**Query Optimization:**

```typescript
// ❌ BAD: N+1 queries
const products = await prisma.product.findMany();
for (const product of products) {
  const user = await prisma.user.findUnique({ where: { id: product.userId } });
}

// ✅ GOOD: Single query with include
const products = await prisma.product.findMany({
  include: { user: true },
});
```

### 2. Caching Strategy

**Implementation:**

```typescript
// Redis caching layer
async getAllProducts(page: number, limit: number) {
  const cacheKey = `products:page:${page}:limit:${limit}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database
  const products = await this.prisma.product.findMany({...});

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(products));

  return products;
}
```

### 3. Pagination Optimization

**Cursor-based pagination for better performance:**

```typescript
// ❌ SLOW: Offset pagination with large offsets
const products = await prisma.product.findMany({
  skip: 1000, // Slow for large offsets
  take: 20,
});

// ✅ FAST: Cursor-based pagination
const products = await prisma.product.findMany({
  take: 20,
  cursor: lastProductId ? { id: lastProductId } : undefined,
  orderBy: { id: 'asc' },
});
```

### 4. Response Compression

**Enable gzip compression:**

```typescript
// main.ts
import compression from 'compression';

app.use(compression());
```

## 📈 Production Monitoring

### Key Metrics Dashboard

**Set up monitoring for:**

1. **Application Metrics**

   - Response time (p50, p95, p99)
   - Error rate
   - Request rate (RPS)
   - Active connections

2. **Database Metrics**

   - Query execution time
   - Connection pool usage
   - Cache hit rate
   - Slow query count

3. **System Metrics**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network I/O

### Alert Thresholds

```yaml
# alerts.yml
alerts:
  critical:
    - metric: p95_response_time
      threshold: 200ms
      for: 5m

    - metric: error_rate
      threshold: 1%
      for: 2m

    - metric: api_availability
      threshold: 99%
      for: 5m

  warning:
    - metric: p95_response_time
      threshold: 150ms
      for: 10m

    - metric: database_connections
      threshold: 80%
      for: 5m
```

## 📋 Performance Testing Checklist

### Pre-Test

- [ ] Database has sufficient test data
- [ ] All indexes are created
- [ ] Connection pools are configured
- [ ] Caching is enabled
- [ ] Monitoring is active
- [ ] Backend is running
- [ ] No other heavy processes running

### During Test

- [ ] Monitor system resources (CPU, memory, disk)
- [ ] Watch database connections
- [ ] Check for error logs
- [ ] Monitor network traffic
- [ ] Observe response times in real-time

### Post-Test

- [ ] Review k6 summary report
- [ ] Check for threshold violations
- [ ] Analyze error patterns
- [ ] Review slow query log
- [ ] Document findings
- [ ] Create performance tickets if needed
- [ ] Update baselines if improved

## 🎓 Best Practices Summary

1. **Always start with smoke tests**
2. **Run load tests daily during active development**
3. **Never skip pre-flight checks**
4. **Monitor system resources during tests**
5. **Document baseline performance metrics**
6. **Set up alerts for threshold violations**
7. **Review and optimize slow queries first**
8. **Implement caching strategically**
9. **Use connection pooling**
10. **Test in production-like environment**

---

**Remember:** Performance is a feature, not an afterthought!
