# MeiliSearch Quick Reference Card - Production Edition

> **Keep this handy for daily operations**

---

## 🚀 Common Operations

### Search Products

```typescript
// Basic search
const results = await meilisearchService.searchProducts('laptop');

// Advanced search with filters
const results = await meilisearchService.searchProducts(
  'laptop',
  {
    category: 'Electronics',
    minPrice: 100,
    maxPrice: 1000,
    condition: 'New',
    inStock: true,
  },
  {
    limit: 20,
    offset: 0,
    sort: ['discount:desc'],
  },
);
```

### Index Operations

```typescript
// Single product (async, non-blocking)
await meilisearchService.indexProduct(product);

// Bulk products (optimized batching)
await meilisearchService.indexProducts(products);

// Update product
await meilisearchService.updateProduct(productId, updatedProduct);

// Delete product
await meilisearchService.deleteProduct(productId);
```

### Monitoring

```typescript
// Get index statistics
const stats = await meilisearchService.getIndexStats();
console.log(stats.numberOfDocuments);

// Get health
const client = meilisearchService.getClient();
const health = await client.health();
```

---

## 📊 Performance Targets

| Metric           | Target          | Alert If        |
| ---------------- | --------------- | --------------- |
| Search Latency   | <50ms           | >200ms          |
| Index Throughput | >1000 docs/sec  | <100 docs/sec   |
| Success Rate     | >99%            | <95%            |
| Memory Usage     | <100MB/10k docs | >500MB/10k docs |

---

## 🎯 Filter Options

```typescript
filters: {
  // Text filters
  category: 'Electronics',
  condition: 'New',

  // Numeric filters
  minPrice: 100,
  maxPrice: 1000,
  userId: 123,

  // Boolean filters
  isActive: true,
  isSold: false,
  inStock: true,
  hasDiscount: true,
}
```

---

## 🔧 Sort Options

```typescript
options: {
  sort: [
    'createdAt:desc', // Newest first
    'createdAt:asc', // Oldest first
    'discountedPrice:asc', // Cheapest first
    'discountedPrice:desc', // Most expensive first
    'discount:desc', // Highest discount first
    'stock:desc', // Most in stock first
  ];
}
```

---

## 🚨 Common Issues & Quick Fixes

### Slow Search (>200ms)

```bash
✅ Check filterable attributes are indexed
✅ Reduce limit to 20 or less
✅ Add specific category filter
✅ Verify MeiliSearch server resources
```

### Out of Memory

```bash
✅ Increase Docker memory: docker update --memory 8g
✅ Reduce BATCH_SIZE to 500
✅ Reduce maxTotalHits to 5000
```

### Circuit Breaker Open

```bash
✅ Check MeiliSearch health: curl http://localhost:7700/health
✅ Restart MeiliSearch: docker restart meilisearch
✅ Check logs: docker logs meilisearch-production
```

### Indexing Failed

```bash
✅ Check network connectivity
✅ Verify MEILI_ADMIN_KEY is correct
✅ Check MeiliSearch disk space
✅ Review error logs
```

---

## 📈 Health Check Endpoints

```bash
# MeiliSearch health
curl http://localhost:7700/health

# Index stats
curl http://localhost:7700/indexes/products/stats \
  -H "Authorization: Bearer YOUR_KEY"

# Your API health
curl http://localhost:3000/api/health/search
```

---

## 🔐 Security Checklist

```bash
✅ Master key is 32+ characters
✅ Master key is not in git
✅ Search-only key for frontend
✅ HTTPS in production
✅ Rate limiting enabled
✅ Input sanitization active
```

---

## 🎓 Best Practices

### DO ✅

- Use batch operations for bulk indexing
- Filter on indexed attributes only
- Implement caching for common queries
- Monitor metrics continuously
- Set resource limits in production
- Use pagination (limit + offset)
- Enable typo tolerance
- Schedule bulk indexing during off-peak

### DON'T ❌

- Don't filter on non-indexed fields
- Don't fetch all results (use pagination)
- Don't expose master key in frontend
- Don't ignore memory limits
- Don't index synchronously in request path
- Don't skip error handling
- Don't forget backups

---

## 📞 Emergency Contacts

### MeiliSearch Not Responding

```bash
# Restart service
docker restart meilisearch-production

# Check logs
docker logs -f meilisearch-production

# Verify data directory
ls -lh meilisearch_data/
```

### High Memory Usage

```bash
# Check current usage
docker stats meilisearch-production

# Increase limit
docker update --memory 8g meilisearch-production

# Restart with new limits
docker restart meilisearch-production
```

### Corrupted Index

```bash
# Last resort: Clear and rebuild
await meilisearchService.clearIndex();
await meilisearchService.syncAllProducts(allProducts);
```

---

## 📊 Metrics Dashboard

### Key Metrics to Monitor

```typescript
1. Search Latency (p50, p95, p99)
2. Queries Per Second (QPS)
3. Error Rate
4. Index Size
5. Memory Usage
6. Circuit Breaker Status
7. Cache Hit Rate
```

---

## 🔍 Useful Commands

```bash
# Check MeiliSearch version
curl http://localhost:7700/version

# Get all indexes
curl http://localhost:7700/indexes \
  -H "Authorization: Bearer YOUR_KEY"

# Get index settings
curl http://localhost:7700/indexes/products/settings \
  -H "Authorization: Bearer YOUR_KEY"

# Test search directly
curl "http://localhost:7700/indexes/products/search?q=laptop" \
  -H "Authorization: Bearer YOUR_KEY"
```

---

## 📚 Documentation Links

- **Production Guide:** `MEILISEARCH_PRODUCTION_GUIDE.md`
- **Enterprise Summary:** `MEILISEARCH_ENTERPRISE_SUMMARY.md`
- **Config File:** `src/meilisearch/meilisearch.config.ts`
- **Official Docs:** https://docs.meilisearch.com

---

**Version:** 2.0.0  
**Last Updated:** November 6, 2025  
**Status:** Production Ready ✅
