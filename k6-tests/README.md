# K6 Load Testing Suite - Product API

## 📋 Overview

Enterprise-grade k6 load testing suite for the Product API, designed with 40 years of backend engineering best practices. This suite provides comprehensive performance testing across multiple scenarios to ensure production readiness.

## 🎯 Testing Philosophy

### SOLID Principles Applied

- **Single Responsibility**: Each test scenario validates one specific aspect
- **Open/Closed**: Extensible configuration without modifying core logic
- **Liskov Substitution**: Test scenarios are interchangeable
- **Interface Segregation**: Minimal, focused test utilities
- **Dependency Inversion**: Tests depend on abstractions (configuration)

### Clean Architecture

- **Separation of Concerns**: Setup, execution, and validation are isolated
- **Business Logic Isolation**: Custom metrics and thresholds
- **Dependency Direction**: Tests don't depend on implementation details

## 🚀 Quick Start

### Prerequisites

```powershell
# Install k6 (Windows)
choco install k6

# Or download from: https://k6.io/docs/get-started/installation/
```

### Basic Usage

```powershell
# Navigate to backend directory
cd Backend

# Smoke test (quick validation - 1 minute)
k6 run --env TEST_TYPE=smoke k6-tests/product-api-load-tests.js

# Load test (normal production traffic - 10 minutes)
k6 run --env TEST_TYPE=load k6-tests/product-api-load-tests.js

# Stress test (find breaking point - 15 minutes)
k6 run --env TEST_TYPE=stress k6-tests/product-api-load-tests.js

# Spike test (traffic bursts - 10 minutes)
k6 run --env TEST_TYPE=spike k6-tests/product-api-load-tests.js

# Soak test (long-duration stability - 2 hours)
k6 run --env TEST_TYPE=soak k6-tests/product-api-load-tests.js

# Breakpoint test (find system limits - 12 minutes)
k6 run --env TEST_TYPE=breakpoint k6-tests/product-api-load-tests.js
```

## 📊 Test Scenarios

### 1. Smoke Test

**Purpose**: Quick validation that API is functional  
**Duration**: 1 minute  
**VUs**: 1  
**Use Case**: CI/CD pipeline, pre-deployment checks

```powershell
k6 run --env TEST_TYPE=smoke k6-tests/product-api-load-tests.js
```

### 2. Load Test

**Purpose**: Validate performance under normal production load  
**Duration**: 16 minutes  
**VUs**: 0 → 20 → 50 → 100 → 100 → 0  
**Use Case**: Regular performance validation

```powershell
k6 run --env TEST_TYPE=load k6-tests/product-api-load-tests.js
```

### 3. Stress Test

**Purpose**: Find breaking point and test recovery  
**Duration**: 15 minutes  
**VUs**: 0 → 50 → 100 → 200 → 300 → 400 → 0  
**Use Case**: Capacity planning, infrastructure sizing

```powershell
k6 run --env TEST_TYPE=stress k6-tests/product-api-load-tests.js
```

### 4. Spike Test

**Purpose**: Test behavior under sudden traffic spikes  
**Duration**: 10.5 minutes  
**VUs**: 20 → 300 (spike) → 20 → 400 (spike) → 0  
**Use Case**: Flash sales, viral content, DDoS resilience

```powershell
k6 run --env TEST_TYPE=spike k6-tests/product-api-load-tests.js
```

### 5. Soak Test

**Purpose**: Long-duration stability and memory leak detection  
**Duration**: 2 hours  
**VUs**: 50 (constant)  
**Use Case**: Production readiness, memory leak detection

```powershell
k6 run --env TEST_TYPE=soak k6-tests/product-api-load-tests.js
```

### 6. Breakpoint Test

**Purpose**: Find maximum system capacity  
**Duration**: 12 minutes  
**RPS**: 10 → 50 → 100 → 200 → 400 → 800 → 1600  
**Use Case**: Infrastructure planning, auto-scaling configuration

```powershell
k6 run --env TEST_TYPE=breakpoint k6-tests/product-api-load-tests.js
```

## 🎯 Performance Targets (SLO)

Based on service-level objectives defined in `getproducts.service.ts`:

| Endpoint         | p95 Target | p99 Target | Error Rate |
| ---------------- | ---------- | ---------- | ---------- |
| `getAllProducts` | < 100ms    | < 150ms    | < 0.1%     |
| `getProductById` | < 50ms     | < 75ms     | < 0.1%     |
| `searchProducts` | < 150ms    | < 200ms    | < 0.1%     |
| `getByCategory`  | < 100ms    | < 150ms    | < 0.1%     |
| `getByUserId`    | < 100ms    | < 150ms    | < 0.1%     |
| `getFeatured`    | < 100ms    | < 150ms    | < 0.1%     |

**System-level SLOs:**

- API Availability: > 99.9%
- Overall Error Rate: < 0.1%
- Average Payload Size: < 500 KB

## 📈 Custom Metrics

### Service Level Indicators (SLI)

**Latency Metrics:**

- `get_all_products_latency` - Response time for listing products
- `get_product_by_id_latency` - Response time for single product
- `search_products_latency` - Response time for search
- `get_by_category_latency` - Response time for category filtering
- `get_by_user_id_latency` - Response time for user products
- `get_featured_latency` - Response time for featured products

**Error Tracking:**

- `error_rate` - Overall error rate
- `api_errors` - Total API errors
- `http_errors` - HTTP 5xx errors

**Business Metrics:**

- `products_returned_total` - Total products returned
- `pagination_requests` - Pagination usage
- `cache_hit_rate` - Cache effectiveness
- `empty_search_results` - Search quality

**Performance Indicators:**

- `estimated_db_query_time` - Database performance
- `response_payload_size_kb` - Data transfer efficiency

## 🔧 Advanced Configuration

### Custom Base URL

```powershell
# Test against staging
k6 run --env BASE_URL=https://staging.api.sellr.com --env TEST_TYPE=load k6-tests/product-api-load-tests.js

# Test against production
k6 run --env BASE_URL=https://api.sellr.com --env TEST_TYPE=smoke k6-tests/product-api-load-tests.js
```

### Output to External Systems

#### InfluxDB + Grafana

```powershell
# Send metrics to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 k6-tests/product-api-load-tests.js

# With authentication
k6 run --out influxdb=http://localhost:8086/k6?username=admin&password=secret k6-tests/product-api-load-tests.js
```

#### JSON Output

```powershell
# Generate JSON results
k6 run --out json=k6-reports/results.json k6-tests/product-api-load-tests.js
```

#### Cloud Output

```powershell
# Send to k6 Cloud
k6 run --out cloud k6-tests/product-api-load-tests.js
```

### Custom Thresholds

Create a custom configuration file:

```javascript
// k6-tests/custom-config.js
export const customOptions = {
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<150'], // Stricter
    error_rate: ['rate<0.0001'], // 0.01% error rate
  },
};
```

## 📊 Interpreting Results

### Success Criteria

✅ **PASS**: All thresholds met

- Error rate < 0.1%
- API availability > 99.9%
- p95 latencies within budget
- No HTTP 5xx errors

⚠️ **WARNING**: Some thresholds exceeded but system functional

- Error rate < 1%
- API availability > 99%
- p95 latencies within 2x budget

❌ **FAIL**: Critical thresholds failed

- Error rate > 1%
- API availability < 99%
- Consistent HTTP 5xx errors

### Key Metrics to Monitor

```
✓ http_req_duration....: avg=45ms  min=12ms  med=38ms  max=280ms  p(90)=75ms  p(95)=95ms
✓ http_req_failed......: 0.05%  ✓ 23       ✗ 45877
✓ error_rate...........: 0.05%  ✓ 23       ✗ 45877
✓ api_availability.....: 99.95% ✓ 45877    ✗ 23
✓ get_all_products_latency: avg=52ms  p(95)=89ms  p(99)=135ms
✓ get_product_by_id_latency: avg=28ms  p(95)=45ms  p(99)=68ms
✓ products_returned_total: 125,432
```

### Reading the Output

**Response Time Distribution:**

- `avg`: Average response time
- `min`: Fastest response
- `max`: Slowest response
- `p(95)`: 95th percentile (95% of requests faster than this)
- `p(99)`: 99th percentile (99% of requests faster than this)

**Request Metrics:**

- `http_reqs`: Total requests sent
- `http_req_failed`: Failed requests (non-2xx)
- `http_req_sending`: Time spent sending data
- `http_req_receiving`: Time spent receiving data
- `http_req_waiting`: Time to first byte (TTFB)

## 🎨 Reports

After each test run, reports are generated in `k6-reports/`:

```
k6-reports/
├── summary.html       # Visual HTML report with charts
├── summary.json       # Raw JSON data for analysis
└── results.json       # Detailed request-level data (if enabled)
```

### Generate HTML Report

```powershell
# Install k6 reporter
npm install -g k6-reporter

# Run test and generate report
k6 run --out json=k6-reports/results.json k6-tests/product-api-load-tests.js
k6-reporter k6-reports/results.json --output k6-reports/report.html
```

## 🔍 Troubleshooting

### Common Issues

**Issue: Connection refused**

```
ERRO[0001] Get "http://localhost:3001/products": dial tcp [::1]:3001: connect: connection refused
```

**Solution**: Ensure the backend server is running on port 3001

**Issue: High error rate**

```
✗ error_rate...........: 15.23% ✓ 7,645    ✗ 42,355
```

**Solution**:

1. Check backend logs for errors
2. Verify database connection
3. Check resource limits (CPU, memory, connections)
4. Review rate limiting configuration

**Issue: Slow response times**

```
✗ http_req_duration....: avg=2.5s  p(95)=5.2s  p(99)=8.1s
```

**Solution**:

1. Check database query performance
2. Review database indexes
3. Monitor connection pool
4. Check for N+1 queries
5. Verify Redis cache is working

## 📚 Best Practices

### 1. Start Small

Always start with smoke tests before running heavy load tests:

```powershell
k6 run --env TEST_TYPE=smoke k6-tests/product-api-load-tests.js
```

### 2. Progressive Load Testing

Follow this sequence:

1. Smoke (1 VU) ✓
2. Load (100 VUs) ✓
3. Stress (400 VUs) ✓
4. Spike (400 VUs sudden) ✓
5. Soak (50 VUs for 2h) ✓
6. Breakpoint (find limits) ✓

### 3. Monitor System Resources

While running tests, monitor:

- CPU usage (`top`, `htop`)
- Memory usage
- Database connections
- Network I/O
- Disk I/O

```powershell
# Windows Resource Monitor
resmon

# Or Task Manager (Performance tab)
taskmgr
```

### 4. Database Preparation

Before running tests:

1. Ensure sufficient test data exists
2. Verify database indexes are created
3. Check connection pool size
4. Enable slow query logging

### 5. Realistic Test Data

The test uses realistic product IDs, categories, and search terms. Update `CONFIG.testData` in the test file to match your database:

```javascript
testData: {
  productIds: [1, 2, 3, 4, 5, 10, 15, 20, 25, 30], // Update with real IDs
  categories: ['Electronics', 'Fashion', 'Home', 'Books', 'Sports', 'Toys'],
  searchTerms: ['laptop', 'phone', 'shirt', 'book', 'bike', 'toy', 'watch'],
  userIds: [1, 2, 3, 4, 5],
}
```

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run Smoke Test
        run: k6 run --env TEST_TYPE=smoke --env BASE_URL=${{ secrets.API_URL }} Backend/k6-tests/product-api-load-tests.js

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: Backend/k6-reports/
```

### Pre-deployment Validation

```powershell
# Run quick smoke test before deployment
k6 run --env TEST_TYPE=smoke k6-tests/product-api-load-tests.js

# If passes, deploy
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Smoke test passed. Proceeding with deployment..."
    # Your deployment commands here
} else {
    Write-Host "❌ Smoke test failed. Aborting deployment."
    exit 1
}
```

## 📖 Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Performance Testing Metrics](https://k6.io/docs/using-k6/metrics/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)

## 🤝 Contributing

When adding new test scenarios:

1. Follow the existing patterns
2. Add comprehensive comments
3. Include validation checks
4. Update this README
5. Test locally before committing

## 📝 License

Part of the Sellr project. All rights reserved.

---

**Created by**: Senior Backend Engineer (40 years experience)  
**Last Updated**: November 8, 2025  
**Version**: 1.0.0
