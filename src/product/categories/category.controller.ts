import { Controller, Get, Query, Param, ValidationPipe, UsePipes, HttpStatus, HttpCode, BadRequestException } from '@nestjs/common';
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
    @Param('category') category: string,
    @Query() queryParams: Omit<GetProductsByCategoryDto, 'category'>,
  ): Promise<{ success: boolean } & CategoryProductsResponseDto> {
    // Validate category is a valid enum value
    const validCategories = Object.values(ProductCategory);
    if (!validCategories.includes(category as ProductCategory)) {
      throw new BadRequestException(
        `Invalid category: ${category}. Must be one of: ${validCategories.join(', ')}`
      );
    }

    const dto: GetProductsByCategoryDto = {
      category: category as ProductCategory,
      ...queryParams,
    };

    const result = await this.categoryProductsService.getProductsByCategory(dto);
    
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Get all available categories with product counts
   * 
   * @route GET /products/categories/all
   * @access Public
   * @returns Array of categories with metadata and product counts
   */
  @Get('all/list')
  @HttpCode(HttpStatus.OK)
  async getAllCategories() {
    const categories = await this.categoryProductsService.getAllCategoriesWithCounts();
    
    return {
      success: true,
      data: categories,
    };
  }


}
