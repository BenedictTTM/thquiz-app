# 🚀 PostgreSQL Search - Quick Reference

## Installation & Setup

```bash
# 1. Run migration
npx prisma migrate deploy

# 2. Verify installation
psql -d your_database -c "SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent');"

# 3. Test search
curl "http://localhost:3000/api/products/search?q=test"
```

---

## Common Operations

### Basic Search

```typescript
const results = await searchService.search('iphone');
```

### Search with Filters

```typescript
const results = await searchService.search('laptop', {
  category: 'Electronics',
  minPrice: 500,
  maxPrice: 2000,
  condition: 'New',
  inStock: true,
});
```

### Autocomplete

```typescript
const suggestions = await searchService.autocomplete('ipho');
```

### Trending Searches

```typescript
const trending = await searchService.getTrendingSearches(10);
```

---

## Search Modes

### Fuzzy Mode (Default)

Typo-tolerant, finds similar matches

```typescript
search('iphne'); // ✅ Finds "iPhone"
```

### Strict Mode

Exact word matching only

```typescript
search('iphone', {}, { useStrictMode: true });
```

---

## Filters

| Filter        | Type     | Example              |
| ------------- | -------- | -------------------- |
| `category`    | string   | `'Electronics'`      |
| `minPrice`    | number   | `100`                |
| `maxPrice`    | number   | `1000`               |
| `condition`   | string   | `'New'`              |
| `tags`        | string[] | `['5G', 'Unlocked']` |
| `userId`      | number   | `123`                |
| `rating`      | number   | `4.0`                |
| `inStock`     | boolean  | `true`               |
| `hasDiscount` | boolean  | `true`               |

---

## Sort Options

| Value        | Description                |
| ------------ | -------------------------- |
| `relevance`  | Best match first (default) |
| `price-asc`  | Lowest price first         |
| `price-desc` | Highest price first        |
| `newest`     | Newest first               |
| `popular`    | Most viewed first          |
| `rating`     | Highest rated first        |

---

## Performance Tuning

### Similarity Threshold

```typescript
// Lower = more results (more false positives)
{
  minSimilarity: 0.2;
}

// Higher = fewer results (more precise)
{
  minSimilarity: 0.5;
}
```

### Pagination

```typescript
{
  page: 1,
  limit: 20  // Max 100
}
```

---

## Maintenance

### Daily (Low Traffic Hours)

```sql
VACUUM ANALYZE "Product";
```

### Weekly

```sql
ANALYZE VERBOSE "Product";
```

### Monthly

```sql
REINDEX INDEX CONCURRENTLY idx_product_search_vector;
REINDEX INDEX CONCURRENTLY idx_product_search_trigram;
```

---

## Monitoring

### Get Metrics

```typescript
const metrics = searchService.getMetrics();
```

### Check Performance

```sql
SELECT
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE tablename = 'Product';
```

---

## Troubleshooting

### Slow Queries

```sql
-- Update statistics
ANALYZE "Product";

-- Rebuild indexes
REINDEX INDEX CONCURRENTLY idx_product_search_vector;
```

### No Results

```typescript
// Decrease similarity threshold
{ minSimilarity: 0.2 }

// Check if extensions are enabled
SELECT extname FROM pg_extension;
```

### Too Many False Positives

```typescript
// Use strict mode
{
  useStrictMode: true;
}

// Or increase threshold
{
  minSimilarity: 0.5;
}
```

---

## PostgreSQL Settings

### Optimal Configuration

```ini
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 64MB
maintenance_work_mem = 1GB
random_page_cost = 1.1
```

---

## Migration from MeiliSearch

```bash
# 1. Remove MeiliSearch
npm uninstall meilisearch

# 2. Update imports
# Before: import { MeiliSearchModule }
# After:  import { SearchModule }

# 3. Update service
# Before: MeiliSearchService
# After:  SearchService

# 4. Run migration
npx prisma migrate deploy
```

---

## API Endpoints

### Search

```
GET /api/products/search?q=iphone&category=Electronics&minPrice=500
```

### Autocomplete

```
GET /api/products/autocomplete?q=ipho
```

### Trending

```
GET /api/products/trending
```

---

## Performance Benchmarks

| Operation       | Target | Typical |
| --------------- | ------ | ------- |
| Simple Search   | <50ms  | 25-35ms |
| Filtered Search | <100ms | 40-60ms |
| Autocomplete    | <20ms  | 5-10ms  |
| Trending        | <30ms  | 15-25ms |

---

## Best Practices

✅ **DO**

- Use pagination (max 100 per page)
- Sanitize user input
- Monitor slow queries
- Run VACUUM regularly
- Use partial indexes

❌ **DON'T**

- Search without LIMIT
- Skip input validation
- Ignore slow query warnings
- Forget to ANALYZE after bulk updates
- Use SELECT \* (specify columns)

---

## Emergency Commands

### Service Down

```sql
-- Check extensions
SELECT extname FROM pg_extension;

-- Rebuild critical indexes
REINDEX INDEX CONCURRENTLY idx_product_search_vector;
REINDEX INDEX CONCURRENTLY idx_product_search_trigram;
```

### Performance Degraded

```sql
-- Update stats immediately
ANALYZE "Product";

-- Clear plan cache
DISCARD PLANS;
```

---

## Resources

- [Full Documentation](./POSTGRESQL_SEARCH_IMPLEMENTATION.md)
- [Maintenance Script](./prisma/migrations/search_maintenance.sql)
- [PostgreSQL Docs](https://www.postgresql.org/docs/current/textsearch.html)

---

**Need Help?** Check logs: `SearchService` logger
