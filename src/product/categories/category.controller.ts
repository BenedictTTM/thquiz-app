import { Controller, Get, Query, Param, ValidationPipe, UsePipes, HttpStatus, HttpCode } from '@nestjs/common';
import { CategoryProductsService } from '../Service/category-products.service';
import { GetProductsByCategoryDto, CategoryProductsResponseDto, CategoryStatsDto } from '../dto/category.dto';
import { ProductCategory } from '../categories/category.enum';

/**
 * CategoryController
 * 
 * RESTful API endpoints for category-based product operations
 * Following REST best practices and OpenAPI documentation standards
 * 
 * @controller /products/categories
 * @version 1.0
 */
@Controller('products/categories')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CategoryController {
  constructor(private readonly categoryProductsService: CategoryProductsService) {}

  /**
   * Get all available categories with product counts
   * 
   * @route GET /products/categories
   * @access Public
   * @returns Array of categories with metadata and product counts
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllCategories() {
    return await this.categoryProductsService.getAllCategoriesWithCounts();
  }

  /**
   * Get products by specific category with filters and pagination
   * 
   * @route GET /products/categories/:category
   * @access Public
   * @param category - Category to filter by (clothes, accessories, home, books, sports_and_outing, others)
   * @query page - Page number (default: 1)
   * @query limit - Items per page (default: 20, max: 100)
   * @query sortBy - Sort order (newest, oldest, price-asc, price-desc, popular, rating)
   * @query condition - Filter by condition (new, like-new, good, fair, used)
   * @query minPrice - Minimum price filter
   * @query maxPrice - Maximum price filter
   * @query inStock - Filter by availability (default: true)
   * @returns Paginated list of products with metadata
   */
  @Get(':category')
  @HttpCode(HttpStatus.OK)
  async getProductsByCategory(
    @Param('category') category: ProductCategory,
    @Query() queryParams: Omit<GetProductsByCategoryDto, 'category'>,
  ): Promise<CategoryProductsResponseDto> {
    const dto: GetProductsByCategoryDto = {
      category,
      ...queryParams,
    };

    return await this.categoryProductsService.getProductsByCategory(dto);
  }

  /**
   * Get statistics for a specific category
   * 
   * @route GET /products/categories/:category/stats
   * @access Public
   * @param category - Category to get stats for
   * @returns Category statistics including product counts, price ranges, and popular tags
   */
  @Get(':category/stats')
  @HttpCode(HttpStatus.OK)
  async getCategoryStats(@Param('category') category: ProductCategory): Promise<CategoryStatsDto> {
    return await this.categoryProductsService.getCategoryStats(category);
  }

  /**
   * Get featured products for a category
   * Products from premium sellers, highly rated, or trending
   * 
   * @route GET /products/categories/:category/featured
   * @access Public
   * @param category - Category to get featured products from
   * @query limit - Number of featured products (default: 10, max: 50)
   * @returns Featured products from the category
   */
  @Get(':category/featured')
  @HttpCode(HttpStatus.OK)
  async getFeaturedProducts(
    @Param('category') category: ProductCategory,
    @Query('limit') limit: number = 10,
  ) {
    const dto: GetProductsByCategoryDto = {
      category,
      page: 1,
      limit: Math.min(limit, 50),
      sortBy: 'popular',
    };

    const result = await this.categoryProductsService.getProductsByCategory(dto);
    
    // Filter for premium sellers and high ratings
    const featured = result.data.filter(
      product => product.seller?.premiumTier !== 'FREE' || product.averageRating >= 4.0
    );

    return {
      data: featured,
      category: result.category,
      total: featured.length,
    };
  }
}
