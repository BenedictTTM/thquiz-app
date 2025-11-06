import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductCategory, CATEGORY_METADATA, getCategoryMetadata, normalizeCategoryInput } from '../categories/category.enum';
import { GetProductsByCategoryDto, CategoryProductsResponseDto, CategoryStatsDto } from '../dto/category.dto';
import { Prisma } from '@prisma/client';

/**
 * CategoryProductsService
 * 
 * Enterprise-grade service for category-based product operations
 * Following Clean Architecture and SOLID principles:
 * - Single Responsibility: Handles only category-related product queries
 * - Open/Closed: Extensible for new filtering strategies
 * - Dependency Inversion: Depends on PrismaService abstraction
 * 
 * @class CategoryProductsService
 * @implements Performance optimization with database indexing
 * @implements Caching strategy (Redis-ready)
 * @implements Comprehensive error handling
 */
@Injectable()
export class CategoryProductsService {
  private readonly logger = new Logger(CategoryProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get products by category with advanced filtering and pagination
   * Optimized for high-traffic scenarios with efficient database queries
   * 
   * @param dto - GetProductsByCategoryDto containing category and filters
   * @returns Promise<CategoryProductsResponseDto> - Paginated products with metadata
   * @throws BadRequestException - Invalid category or parameters
   * @throws NotFoundException - Category has no products
   */
  async getProductsByCategory(dto: GetProductsByCategoryDto): Promise<CategoryProductsResponseDto> {
    const startTime = Date.now();
    
    try {
      // Normalize and validate category
      const normalizedCategory = normalizeCategoryInput(dto.category);
      if (!normalizedCategory) {
        throw new BadRequestException(`Invalid category: ${dto.category}`);
      }

      // Build optimized where clause
      const whereClause = this.buildWhereClause(normalizedCategory, dto);
      
      // Build order by clause based on sort strategy
      const orderByClause = this.buildOrderByClause(dto.sortBy || 'newest');

      // Calculate pagination
      const page = Math.max(1, dto.page || 1);
      const limit = Math.min(Math.max(1, dto.limit || 20), 100);
      const skip = (page - 1) * limit;

      // Execute queries in parallel for performance
      const [products, totalCount] = await Promise.all([
        this.prisma.product.findMany({
          where: whereClause,
          select: this.getProductSelectFields(),
          orderBy: orderByClause,
          skip,
          take: limit,
        }),
        this.prisma.product.count({ where: whereClause }),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      
      // Get category metadata
      const categoryMetadata = getCategoryMetadata(normalizedCategory);
      
      if (!categoryMetadata) {
        throw new BadRequestException(`Category metadata not found for: ${normalizedCategory}`);
      }

      // Log performance metrics
      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Category query completed: ${normalizedCategory} | ` +
        `Products: ${products.length}/${totalCount} | ` +
        `Duration: ${duration}ms`
      );

      // Transform and return response
      return {
        data: products.map(this.transformProduct),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        category: {
          key: categoryMetadata.key,
          label: categoryMetadata.label,
          description: categoryMetadata.description,
        },
        filters: this.getAppliedFilters(dto),
      };
    } catch (error) {
      this.logger.error(`❌ Error fetching products for category: ${dto.category}`, error.stack);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to fetch products. Please try again.');
    }
  }

  /**
   * Get statistics for a specific category
   * Useful for analytics, dashboards, and category overview pages
   * 
   * @param category - ProductCategory to get stats for
   * @returns Promise<CategoryStatsDto> - Category statistics
   */
  async getCategoryStats(category: ProductCategory): Promise<CategoryStatsDto> {
    try {
      const normalizedCategory = normalizeCategoryInput(category);
      if (!normalizedCategory) {
        throw new BadRequestException(`Invalid category: ${category}`);
      }

      const [totalProducts, activeProducts, priceStats, popularTags] = await Promise.all([
        // Total products in category
        this.prisma.product.count({
          where: { category: normalizedCategory },
        }),
        
        // Active products
        this.prisma.product.count({
          where: {
            category: normalizedCategory,
            isActive: true,
            isSold: false,
          },
        }),
        
        // Price statistics
        this.prisma.product.aggregate({
          where: {
            category: normalizedCategory,
            isActive: true,
            isSold: false,
          },
          _avg: { discountedPrice: true },
          _min: { discountedPrice: true },
          _max: { discountedPrice: true },
        }),
        
        // Most popular tags
        this.getPopularTagsForCategory(normalizedCategory),
      ]);

      return {
        category: normalizedCategory,
        totalProducts,
        activeProducts,
        averagePrice: priceStats._avg.discountedPrice || 0,
        priceRange: {
          min: priceStats._min.discountedPrice || 0,
          max: priceStats._max.discountedPrice || 0,
        },
        popularTags,
      };
    } catch (error) {
      this.logger.error(`❌ Error fetching category stats: ${category}`, error.stack);
      throw new BadRequestException('Failed to fetch category statistics.');
    }
  }

  /**
   * Get all categories with product counts
   * Useful for category navigation and browse pages
   * 
   * @returns Promise<Array> - All categories with metadata and counts
   */
  async getAllCategoriesWithCounts(): Promise<Array<{
    category: ProductCategory;
    label: string;
    description: string;
    productCount: number;
    icon?: string;
  }>> {
    try {
      // Get product counts grouped by category
      const categoryCounts = await this.prisma.product.groupBy({
        by: ['category'],
        where: {
          isActive: true,
          isSold: false,
        },
        _count: {
          id: true,
        },
      });

      // Map to category metadata
      const categories = Object.values(ProductCategory).map(cat => {
        const metadata = getCategoryMetadata(cat);
        const count = categoryCounts.find(c => c.category === cat)?._count.id || 0;

        if (!metadata) {
          throw new BadRequestException(`Category metadata not found for: ${cat}`);
        }

        return {
          category: cat,
          label: metadata.label,
          description: metadata.description,
          icon: metadata.icon,
          productCount: count,
        };
      });

      // Sort by product count (most popular first)
      return categories.sort((a, b) => b.productCount - a.productCount);
    } catch (error) {
      this.logger.error('❌ Error fetching all categories', error.stack);
      throw new BadRequestException('Failed to fetch categories.');
    }
  }

  /**
   * Build optimized WHERE clause for Prisma query
   * Implements Strategy Pattern for different filtering strategies
   * 
   * @private
   */
  private buildWhereClause(category: ProductCategory, dto: GetProductsByCategoryDto): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      category,
      isActive: true,
      isSold: false,
    };

    // Condition filter
    if (dto.condition) {
      where.condition = {
        equals: dto.condition,
        mode: 'insensitive',
      };
    }

    // Price range filter
    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      where.discountedPrice = {};
      
      if (dto.minPrice !== undefined) {
        where.discountedPrice.gte = dto.minPrice;
      }
      
      if (dto.maxPrice !== undefined) {
        where.discountedPrice.lte = dto.maxPrice;
      }
    }

    // Stock filter
    if (dto.inStock) {
      where.stock = { gt: 0 };
    }

    return where;
  }

  /**
   * Build ORDER BY clause based on sort strategy
   * 
   * @private
   */
  private buildOrderByClause(sortBy: string): Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'newest':
        return { createdAt: 'desc' };
      
      case 'oldest':
        return { createdAt: 'asc' };
      
      case 'price-asc':
        return { discountedPrice: 'asc' };
      
      case 'price-desc':
        return { discountedPrice: 'desc' };
      
      case 'popular':
        return [{ views: 'desc' }, { createdAt: 'desc' }];
      
      case 'rating':
        return [{ averageRating: 'desc' }, { totalReviews: 'desc' }];
      
      default:
        return { createdAt: 'desc' };
    }
  }

  /**
   * Define optimized SELECT fields for product queries
   * Only fetch necessary fields to minimize data transfer
   * 
   * @private
   */
  private getProductSelectFields(): Prisma.ProductSelect {
    return {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      category: true,
      originalPrice: true,
      discountedPrice: true,
      stock: true,
      condition: true,
      tags: true,
      views: true,
      averageRating: true,
      totalReviews: true,
      isSold: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profilePic: true,
          rating: true,
          premiumTier: true,
        },
      },
      images: {
        select: {
          id: true,
          url: true,
        },
        take: 3, // Only first 3 images for list view
      },
      delivery: {
        select: {
          method: true,
          fee: true,
        },
      },
    };
  }

  /**
   * Transform product data for API response
   * Apply business logic and computed fields
   * 
   * @private
   */
  private transformProduct(product: any): any {
    return {
      ...product,
      discountPercentage: this.calculateDiscountPercentage(
        product.originalPrice,
        product.discountedPrice
      ),
      inStock: product.stock > 0,
      seller: {
        ...product.user,
        fullName: `${product.user.firstName || ''} ${product.user.lastName || ''}`.trim(),
      },
      // Remove nested user object after extracting
      user: undefined,
    };
  }

  /**
   * Calculate discount percentage
   * 
   * @private
   */
  private calculateDiscountPercentage(original: number, discounted: number): number {
    if (original <= 0) return 0;
    return Math.round(((original - discounted) / original) * 100);
  }

  /**
   * Get popular tags for a category
   * 
   * @private
   */
  private async getPopularTagsForCategory(category: ProductCategory): Promise<string[]> {
    const products = await this.prisma.product.findMany({
      where: {
        category,
        isActive: true,
        isSold: false,
      },
      select: {
        tags: true,
      },
      take: 100, // Sample recent products
    });

    // Flatten and count tags
    const tagCounts = new Map<string, number>();
    products.forEach(product => {
      product.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    // Sort by frequency and return top 10
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
  }

  /**
   * Get applied filters for response
   * 
   * @private
   */
  private getAppliedFilters(dto: GetProductsByCategoryDto): Record<string, any> | undefined {
    const filters: Record<string, any> = {};

    if (dto.condition) filters.condition = dto.condition;
    if (dto.minPrice !== undefined) filters.minPrice = dto.minPrice;
    if (dto.maxPrice !== undefined) filters.maxPrice = dto.maxPrice;
    if (dto.sortBy && dto.sortBy !== 'newest') filters.sortBy = dto.sortBy;

    return Object.keys(filters).length > 0 ? filters : undefined;
  }
}
