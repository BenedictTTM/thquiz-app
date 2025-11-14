# Quick Reference - k6 Load Testing

## ⚡ Quick Commands

```powershell
# Smoke Test (1 min)
k6 run --env TEST_TYPE=smoke k6-tests/product-api-load-tests.js

# Load Test (16 min)
k6 run --env TEST_TYPE=load k6-tests/product-api-load-tests.js

# Stress Test (15 min)
k6 run --env TEST_TYPE=stress k6-tests/product-api-load-tests.js

# Spike Test (10.5 min)
k6 run --env TEST_TYPE=spike k6-tests/product-api-load-tests.js

# Soak Test (2 hours)
k6 run --env TEST_TYPE=soak k6-tests/product-api-load-tests.js

# Breakpoint Test (12 min)
k6 run --env TEST_TYPE=breakpoint k6-tests/product-api-load-tests.js
```

## 🎯 Performance Targets

| Endpoint       | p95     | p99     |
| -------------- | ------- | ------- |
| getAllProducts | < 100ms | < 150ms |
| getProductById | < 50ms  | < 75ms  |
| searchProducts | < 150ms | < 200ms |
| getByCategory  | < 100ms | < 150ms |

## 📊 Test Types

| Type       | Duration | VUs      | Purpose          |
| ---------- | -------- | -------- | ---------------- |
| Smoke      | 1m       | 1        | Quick validation |
| Load       | 16m      | 0→100    | Normal traffic   |
| Stress     | 15m      | 0→400    | Find limits      |
| Spike      | 10.5m    | 20→400   | Traffic bursts   |
| Soak       | 2h       | 50       | Stability        |
| Breakpoint | 12m      | Variable | Max capacity     |

## ✅ Success Criteria

- Error rate < 0.1%
- API availability > 99.9%
- p95 latencies within budget
- No HTTP 5xx errors

## 🔧 Common Options

```powershell
# Custom URL
--env BASE_URL=https://api.example.com

# Output to JSON
--out json=results.json

# Output to InfluxDB
--out influxdb=http://localhost:8086/k6

# Quiet mode
--quiet

# Verbose mode
--verbose
```

## 📈 Reading Results

```
✓ http_req_duration....: avg=45ms  p(95)=95ms  p(99)=135ms
✓ http_req_failed......: 0.05%
✓ error_rate...........: 0.05%
✓ api_availability.....: 99.95%
```

✅ = Threshold passed  
✗ = Threshold failed

## 🚨 Troubleshooting

**High error rate?**
→ Check backend logs, database connections

**Slow responses?**
→ Check database indexes, query performance

**Connection refused?**
→ Ensure backend is running on correct port
