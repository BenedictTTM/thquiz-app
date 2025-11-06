-- =====================================================
-- DATABASE OPTIMIZATION FOR CATEGORY SYSTEM
-- =====================================================
-- Author: Engineering Team
-- Date: November 5, 2025
-- Purpose: Optimize category-based product queries
-- =====================================================
-- Drop existing indexes if they exist (for clean re-run)
DROP INDEX IF EXISTS idx_product_category;
DROP INDEX IF EXISTS idx_product_category_active;
DROP INDEX IF EXISTS idx_product_category_price;
DROP INDEX IF EXISTS idx_product_category_created;
DROP INDEX IF EXISTS idx_product_category_rating;
DROP INDEX IF EXISTS idx_product_category_views;
DROP INDEX IF EXISTS idx_product_category_stock;
DROP INDEX IF EXISTS idx_product_category_condition;
-- =====================================================
-- PRIMARY CATEGORY INDEX
-- =====================================================
-- Basic index on category column for category filtering
-- Used in: All category queries
-- Impact: High - Reduces full table scans
CREATE INDEX idx_product_category ON "Product"(category);
-- =====================================================
-- COMPOSITE INDEX: Category + Active Status
-- =====================================================
-- Optimizes queries filtering by category and active/sold status
-- Used in: Most category listings (excludes inactive/sold items)
-- Impact: Very High - Most common query pattern
CREATE INDEX idx_product_category_active ON "Product"(category, "isActive", "isSold");
-- =====================================================
-- COMPOSITE INDEX: Category + Price
-- =====================================================
-- Optimizes price-based sorting and filtering within categories
-- Used in: Price range filters, price sorting
-- Impact: High - Common filter combination
CREATE INDEX idx_product_category_price ON "Product"(category, "discountedPrice");
-- =====================================================
-- COMPOSITE INDEX: Category + Creation Date
-- =====================================================
-- Optimizes "newest/oldest" sorting within categories
-- Used in: Default sorting (newest first)
-- Impact: High - Default sort order
CREATE INDEX idx_product_category_created ON "Product"(category, "createdAt" DESC);
-- =====================================================
-- COMPOSITE INDEX: Category + Rating
-- =====================================================
-- Optimizes rating-based sorting within categories
-- Used in: Sort by highest rated
-- Impact: Medium - Less common but useful
CREATE INDEX idx_product_category_rating ON "Product"(
  category,
  "averageRating" DESC,
  "totalReviews" DESC
);
-- =====================================================
-- COMPOSITE INDEX: Category + Views (Popularity)
-- =====================================================
-- Optimizes popularity-based sorting within categories
-- Used in: Sort by most popular
-- Impact: Medium - Featured/trending products
CREATE INDEX idx_product_category_views ON "Product"(category, views DESC);
-- =====================================================
-- COMPOSITE INDEX: Category + Stock
-- =====================================================
-- Optimizes stock availability filtering within categories
-- Used in: In-stock filters
-- Impact: Medium - Common filter
CREATE INDEX idx_product_category_stock ON "Product"(category, stock);
-- =====================================================
-- COMPOSITE INDEX: Category + Condition
-- =====================================================
-- Optimizes condition-based filtering within categories
-- Used in: Filter by condition (new, used, etc.)
-- Impact: Medium - Common filter
CREATE INDEX idx_product_category_condition ON "Product"(category, condition);
-- =====================================================
-- COVERING INDEX (Advanced Optimization)
-- =====================================================
-- Includes commonly accessed columns in the index
-- Allows index-only scans without table lookups
-- PostgreSQL specific: INCLUDE clause
-- Note: May increase index size significantly
CREATE INDEX idx_product_category_covering ON "Product"(category, "isActive", "isSold", "createdAt" DESC) INCLUDE (
  id,
  title,
  "discountedPrice",
  "originalPrice",
  stock,
  condition
);
-- =====================================================
-- ANALYZE & VACUUM
-- =====================================================
-- Update table statistics for query planner
-- Recommended after creating indexes
ANALYZE "Product";
-- Optional: Vacuum to reclaim space and update statistics
-- VACUUM ANALYZE "Product";
-- =====================================================
-- INDEX VERIFICATION
-- =====================================================
-- View all indexes on Product table
SELECT tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'Product'
ORDER BY indexname;
-- =====================================================
-- INDEX USAGE STATISTICS
-- =====================================================
-- Query to monitor index usage (run after deployment)
-- Helps identify unused indexes
SELECT schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'Product'
ORDER BY idx_scan DESC;
-- =====================================================
-- QUERY PERFORMANCE TESTING
-- =====================================================
-- Test query performance with EXPLAIN ANALYZE
-- Test 1: Basic category query
EXPLAIN ANALYZE
SELECT *
FROM "Product"
WHERE category = 'clothes'
  AND "isActive" = true
  AND "isSold" = false
ORDER BY "createdAt" DESC
LIMIT 20;
-- Test 2: Category with price filter
EXPLAIN ANALYZE
SELECT *
FROM "Product"
WHERE category = 'clothes'
  AND "isActive" = true
  AND "isSold" = false
  AND "discountedPrice" BETWEEN 10 AND 100
ORDER BY "discountedPrice" ASC
LIMIT 20;
-- Test 3: Category with condition filter
EXPLAIN ANALYZE
SELECT *
FROM "Product"
WHERE category = 'clothes'
  AND "isActive" = true
  AND "isSold" = false
  AND condition = 'new'
ORDER BY "createdAt" DESC
LIMIT 20;
-- =====================================================
-- MAINTENANCE RECOMMENDATIONS
-- =====================================================
-- 1. Monitor index usage regularly (weekly)
-- 2. REINDEX if fragmentation occurs (monthly)
-- 3. Update statistics with ANALYZE (daily via cron)
-- 4. Review slow query logs for optimization opportunities
-- 5. Consider partitioning Product table by category for massive scale
-- =====================================================
-- ROLLBACK SCRIPT
-- =====================================================
-- If you need to remove these indexes:
/*
 DROP INDEX IF EXISTS idx_product_category;
 DROP INDEX IF EXISTS idx_product_category_active;
 DROP INDEX IF EXISTS idx_product_category_price;
 DROP INDEX IF EXISTS idx_product_category_created;
 DROP INDEX IF EXISTS idx_product_category_rating;
 DROP INDEX IF EXISTS idx_product_category_views;
 DROP INDEX IF EXISTS idx_product_category_stock;
 DROP INDEX IF EXISTS idx_product_category_condition;
 DROP INDEX IF EXISTS idx_product_category_covering;
 */
-- =====================================================
-- END OF MIGRATION
-- =====================================================