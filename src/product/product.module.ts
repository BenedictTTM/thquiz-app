import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CrudService } from './Service/crud.products.service';
import { GetProductsService } from './Service/getproducts.service';
import { SearchProductsService } from './Service/search.products.service';
import { SearchProductsServiceV2 } from './Service/search.products.service.v2';
import { FlashSalesService } from './Service/flashsales.service';
import { CategoryProductsService } from './Service/category-products.service';
import { CategoryController } from './categories/category.controller';
import { SearchMetricsController } from './metrics/search-metrics.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Adjust path as needed
import { AuthGuard } from '../guards/auth.guard'; // Adjust path as needed
import { RolesGuard } from '../guards/roles.guard'; // Adjust path as needed
import { AuthModule } from 'src/auth/auth.module'; // Adjust the import path as necessary
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module'; // Import CloudinaryModule if needed
import { MeiliSearchModule } from '../meilisearch/meilisearch.module';
import { CacheConfigModule } from '../cache/cache.module';

/**
 * ============================================================================
 * PRODUCT MODULE - ENTERPRISE EDITION
 * ============================================================================
 * 
 * FEATURES:
 * ✅ Advanced product search with MeiliSearch
 * ✅ Distributed caching with Redis
 * ✅ Performance monitoring and metrics
 * ✅ Circuit breaker and fault tolerance
 * ✅ Health checks and observability
 * ✅ Flash sales management
 * ✅ Category-based product filtering
 * 
 * MIGRATION PATH:
 * 1. Keep existing SearchProductsService (v1) for compatibility
 * 2. Add new SearchProductsServiceV2 (enterprise-grade)
 * 3. Gradually migrate endpoints to v2
 * 4. Monitor metrics and performance
 * 5. Deprecate v1 after successful migration
 * 
 * @version 2.0.0 - Enterprise Production Grade
 */

@Module({
  imports: [
    PrismaModule, 
    AuthModule, 
    CloudinaryModule, 
    MeiliSearchModule,
    CacheConfigModule, // NEW: Enterprise caching module
  ],
  controllers: [
    ProductController, 
    CategoryController,
    SearchMetricsController, // NEW: Metrics and monitoring
  ],
  providers: [
    ProductService,
    CrudService,
    GetProductsService,
    SearchProductsService,       // V1: Keep for backward compatibility
    SearchProductsServiceV2,     // V2: NEW Enterprise-grade search
    FlashSalesService,
    CategoryProductsService,
    AuthGuard, 
    RolesGuard
  ],
  exports: [
    ProductService, 
    CategoryProductsService,
    SearchProductsServiceV2,     // Export V2 for other modules
  ]
})
export class ProductModule {}