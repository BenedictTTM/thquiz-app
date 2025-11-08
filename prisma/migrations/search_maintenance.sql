-- ============================================================================
-- PostgreSQL Search Maintenance Script
-- Run this periodically to maintain optimal search performance
-- 
-- Schedule: 
-- - Daily: VACUUM ANALYZE
-- - Weekly: Statistics update
-- - Monthly: REINDEX
-- ============================================================================
-- ============================================================================
-- DAILY MAINTENANCE (Run during low traffic hours)
-- ============================================================================
-- Update table statistics for query planner
ANALYZE "Product";
-- Reclaim storage and update statistics
VACUUM ANALYZE "Product";
-- ============================================================================
-- WEEKLY MAINTENANCE
-- ============================================================================
-- Update all statistics
ANALYZE VERBOSE "Product";
-- Check index bloat
SELECT schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED INDEX - Consider Dropping'
        WHEN idx_scan < 100 THEN 'Low Usage'
        ELSE 'Active'
    END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND tablename = 'Product'
    AND indexname LIKE '%search%'
ORDER BY idx_scan DESC;
-- ============================================================================
-- MONTHLY MAINTENANCE
-- ============================================================================
-- Rebuild search indexes concurrently (no downtime)
-- IMPORTANT: Run during low traffic period
REINDEX INDEX CONCURRENTLY idx_product_search_vector;
REINDEX INDEX CONCURRENTLY idx_product_search_trigram;
REINDEX INDEX CONCURRENTLY idx_product_active_search;
REINDEX INDEX CONCURRENTLY idx_product_category_search;
-- Full vacuum (more aggressive, blocks table)
-- Only run during maintenance window
-- VACUUM FULL "Product";
-- ============================================================================
-- PERFORMANCE MONITORING
-- ============================================================================
-- Check search index effectiveness
SELECT relname as table_name,
    seq_scan as sequential_scans,
    seq_tup_read as seq_rows_read,
    idx_scan as index_scans,
    idx_tup_fetch as index_rows_fetched,
    CASE
        WHEN seq_scan > 0
        AND idx_scan > 0 THEN round(
            (100.0 * idx_scan / (seq_scan + idx_scan))::numeric,
            2
        )
        ELSE 0
    END as index_usage_percent
FROM pg_stat_user_tables
WHERE relname = 'Product';
-- Check slow queries (requires pg_stat_statements extension)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT substring(query, 1, 100) as query_preview,
    calls,
    round(mean_exec_time::numeric, 2) as avg_time_ms,
    round(max_exec_time::numeric, 2) as max_time_ms,
    round(total_exec_time::numeric, 2) as total_time_ms
FROM pg_stat_statements
WHERE query ILIKE '%Product%search%'
ORDER BY mean_exec_time DESC
LIMIT 10;
-- Check index size and usage
SELECT indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'Product'
ORDER BY pg_relation_size(indexrelid) DESC;
-- ============================================================================
-- TROUBLESHOOTING QUERIES
-- ============================================================================
-- Find products with NULL search fields (should be none with COALESCE)
SELECT id,
    title,
    "searchVector",
    "searchText"
FROM "Product"
WHERE "searchVector" IS NULL
    OR "searchText" IS NULL
LIMIT 10;
-- Test search performance
EXPLAIN ANALYZE
SELECT id,
    title,
    ts_rank_cd("searchVector", to_tsquery('english', 'iphone')) as rank
FROM "Product"
WHERE "searchVector" @@ to_tsquery('english', 'iphone')
    AND "isActive" = true
    AND "isSold" = false
ORDER BY rank DESC
LIMIT 20;
-- Test trigram performance
EXPLAIN ANALYZE
SELECT id,
    title,
    similarity("searchText", 'iphone case') as similarity
FROM "Product"
WHERE "searchText" % 'iphone case'
    AND "isActive" = true
    AND "isSold" = false
ORDER BY similarity DESC
LIMIT 20;
-- ============================================================================
-- OPTIMIZATION RECOMMENDATIONS
-- ============================================================================
-- Check if pg_stat_statements is available
SELECT *
FROM pg_available_extensions
WHERE name = 'pg_stat_statements';
-- Check current autovacuum settings
SELECT name,
    setting,
    unit,
    context
FROM pg_settings
WHERE name LIKE '%autovacuum%'
    OR name LIKE '%vacuum%'
ORDER BY name;
-- Check table bloat
SELECT schemaname,
    tablename,
    pg_size_pretty(
        pg_total_relation_size(schemaname || '.' || tablename)
    ) as total_size,
    pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as table_size,
    pg_size_pretty(
        pg_total_relation_size(schemaname || '.' || tablename) - pg_relation_size(schemaname || '.' || tablename)
    ) as indexes_size
FROM pg_tables
WHERE tablename = 'Product';
-- ============================================================================
-- BACKUP SEARCH INDEXES (Before major maintenance)
-- ============================================================================
-- Get index definitions for backup
SELECT indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Product'
    AND indexname LIKE '%search%';
-- ============================================================================
-- NOTES
-- ============================================================================
-- VACUUM vs VACUUM FULL:
-- - VACUUM: Online operation, reclaims space, updates stats
-- - VACUUM FULL: Locks table, rewrites entire table, more aggressive
-- 
-- REINDEX vs REINDEX CONCURRENTLY:
-- - REINDEX: Fast but locks index
-- - REINDEX CONCURRENTLY: Slower but no locks (requires PostgreSQL 12+)
--
-- Autovacuum:
-- PostgreSQL runs autovacuum automatically, but manual VACUUM is recommended
-- for heavily updated tables to ensure optimal performance.
--
-- When to run maintenance:
-- - ANALYZE: After bulk inserts/updates/deletes
-- - VACUUM: Daily during low traffic
-- - REINDEX: Monthly or when index bloat > 30%
-- - VACUUM FULL: Quarterly during maintenance window
-- ============================================================================
-- EMERGENCY PERFORMANCE RECOVERY
-- ============================================================================
-- If search is extremely slow, run these in order:
-- 1. Update statistics immediately
ANALYZE "Product";
-- 2. Clear query plan cache
DISCARD PLANS;
-- 3. Rebuild critical indexes (concurrent to avoid downtime)
REINDEX INDEX CONCURRENTLY idx_product_search_vector;
REINDEX INDEX CONCURRENTLY idx_product_search_trigram;
-- 4. Check for long-running queries blocking indexes
SELECT pid,
    usename,
    application_name,
    state,
    query_start,
    state_change,
    substring(query, 1, 100) as query
FROM pg_stat_activity
WHERE state != 'idle'
    AND query ILIKE '%Product%'
ORDER BY query_start;
-- 5. If necessary, kill blocking queries (use with caution!)
-- SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = <problematic_pid>;