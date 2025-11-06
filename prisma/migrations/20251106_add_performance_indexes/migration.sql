-- Add performance indexes for Product table
-- These indexes optimize category queries, sorting, and filtering
-- Basic indexes
CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product"("isActive");
CREATE INDEX IF NOT EXISTS "Product_isSold_idx" ON "Product"("isSold");
CREATE INDEX IF NOT EXISTS "Product_stock_idx" ON "Product"("stock");
CREATE INDEX IF NOT EXISTS "Product_discountedPrice_idx" ON "Product"("discountedPrice");
-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "Product_isActive_isSold_idx" ON "Product"("isActive", "isSold");
CREATE INDEX IF NOT EXISTS "Product_isActive_createdAt_idx" ON "Product"("isActive", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Product_category_isActive_isSold_idx" ON "Product"("category", "isActive", "isSold");
CREATE INDEX IF NOT EXISTS "Product_category_createdAt_idx" ON "Product"("category", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Product_category_discountedPrice_idx" ON "Product"("category", "discountedPrice");
CREATE INDEX IF NOT EXISTS "Product_category_views_idx" ON "Product"("category", "views" DESC);
CREATE INDEX IF NOT EXISTS "Product_category_averageRating_idx" ON "Product"("category", "averageRating" DESC);
CREATE INDEX IF NOT EXISTS "Product_userId_isActive_idx" ON "Product"("userId", "isActive");
-- Index for User's availableSlots (used in product creation)
CREATE INDEX IF NOT EXISTS "User_availableSlots_idx" ON "User"("availableSlots");