-- ============================================================================
-- PostgreSQL Full-Text Search Implementation - Fixed Version
-- Using pg_trgm (Trigram) Extension for Production-Grade Search
-- 
-- Author: Senior Backend Engineer (40 years experience)
-- Date: 2025-11-08
-- 
-- FIX: Removed array_to_string from GENERATED columns (not immutable)
--      Using triggers instead for dynamic updates
-- ============================================================================
-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Trigram similarity search
CREATE EXTENSION IF NOT EXISTS unaccent;
-- Remove accents for better matching
CREATE EXTENSION IF NOT EXISTS btree_gin;
-- Multi-column GIN indexes
-- ============================================================================
-- Add Search Columns (will be populated by triggers)
-- ============================================================================
-- Add searchVector column (will be updated by trigger)
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "searchVector" tsvector;
-- Add searchText column (will be updated by trigger)
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "searchText" text;
-- ============================================================================
-- Create Trigger Function to Update Search Columns
-- ============================================================================
CREATE OR REPLACE FUNCTION update_product_search_fields() RETURNS TRIGGER AS $$ BEGIN -- Update searchVector with weighted full-text search
    NEW."searchVector" := setweight(
        to_tsvector('english', coalesce(NEW."title", '')),
        'A'
    ) || setweight(
        to_tsvector(
            'english',
            coalesce(array_to_string(NEW."tags", ' '), '')
        ),
        'B'
    ) || setweight(
        to_tsvector('english', coalesce(NEW."category", '')),
        'B'
    ) || setweight(
        to_tsvector('english', coalesce(NEW."condition", '')),
        'C'
    ) || setweight(
        to_tsvector('english', coalesce(NEW."description", '')),
        'D'
    );
-- Update searchText for trigram similarity
NEW."searchText" := coalesce(NEW."title", '') || ' ' || coalesce(NEW."category", '') || ' ' || coalesce(array_to_string(NEW."tags", ' '), '') || ' ' || coalesce(NEW."condition", '') || ' ' || coalesce(NEW."description", '');
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- ============================================================================
-- Create Triggers
-- ============================================================================
-- Trigger for INSERT and UPDATE
DROP TRIGGER IF EXISTS product_search_update ON "Product";
CREATE TRIGGER product_search_update BEFORE
INSERT
    OR
UPDATE ON "Product" FOR EACH ROW EXECUTE FUNCTION update_product_search_fields();
-- ============================================================================
-- Update Existing Products
-- ============================================================================
-- Populate search fields for existing products
UPDATE "Product"
SET "searchVector" = setweight(
        to_tsvector('english', coalesce("title", '')),
        'A'
    ) || setweight(
        to_tsvector(
            'english',
            coalesce(array_to_string("tags", ' '), '')
        ),
        'B'
    ) || setweight(
        to_tsvector('english', coalesce("category", '')),
        'B'
    ) || setweight(
        to_tsvector('english', coalesce("condition", '')),
        'C'
    ) || setweight(
        to_tsvector('english', coalesce("description", '')),
        'D'
    ),
    "searchText" = coalesce("title", '') || ' ' || coalesce("category", '') || ' ' || coalesce(array_to_string("tags", ' '), '') || ' ' || coalesce("condition", '') || ' ' || coalesce("description", '')
WHERE "searchVector" IS NULL
    OR "searchText" IS NULL;
-- ============================================================================
-- High-Performance Search Indexes
-- ============================================================================
-- GIN index for full-text search (tsvector)
CREATE INDEX IF NOT EXISTS "idx_product_search_vector" ON "Product" USING GIN ("searchVector");
-- GIN index for trigram similarity (fuzzy search)
CREATE INDEX IF NOT EXISTS "idx_product_search_trigram" ON "Product" USING GIN ("searchText" gin_trgm_ops);
-- Composite index for active products search
CREATE INDEX IF NOT EXISTS "idx_product_active_search" ON "Product" ("isActive", "isSold", "createdAt" DESC)
WHERE "isActive" = true
    AND "isSold" = false;
-- Category-based search optimization
CREATE INDEX IF NOT EXISTS "idx_product_category_search" ON "Product" ("category", "isActive", "discountedPrice")
WHERE "isActive" = true
    AND "isSold" = false;
-- Price range search optimization
CREATE INDEX IF NOT EXISTS "idx_product_price_search" ON "Product" ("discountedPrice", "isActive")
WHERE "isActive" = true
    AND "isSold" = false;
-- Stock availability index
CREATE INDEX IF NOT EXISTS "idx_product_stock_search" ON "Product" ("stock", "isActive")
WHERE "isActive" = true
    AND "isSold" = false
    AND "stock" > 0;
-- ============================================================================
-- Update Statistics
-- ============================================================================
ANALYZE "Product";
-- ============================================================================
-- Verification
-- ============================================================================
-- Check extensions
SELECT extname
FROM pg_extension
WHERE extname IN ('pg_trgm', 'unaccent', 'btree_gin');
-- Check columns exist
SELECT column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'Product'
    AND column_name IN ('searchVector', 'searchText');
-- Check indexes
SELECT indexname
FROM pg_indexes
WHERE tablename = 'Product'
    AND indexname LIKE '%search%';