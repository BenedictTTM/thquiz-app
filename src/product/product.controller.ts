import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe , Request , UseGuards, ParseFloatPipe, DefaultValuePipe } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductDto } from './dto/product.dto';
import { AuthGuard } from '../guards/auth.guard'; // Adjust the import path as necessary
import { FilesInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';
import { UploadedFiles, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { MeiliSearchService } from '../meilisearch/meilisearch.service';
import { SearchProductsService } from './Service/search.products.service';
import { SearchProductsServiceV2 } from './Service/search.products.service.v2';
import { FlashSalesService } from './Service/flashsales.service';


@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly meilisearchService: MeiliSearchService,
    private readonly searchProductsService: SearchProductsService, // V1: Legacy (keep for compatibility)
    private readonly searchProductsServiceV2: SearchProductsServiceV2, // V2: Enterprise-grade
    private readonly flashSalesService: FlashSalesService,
  ) {}


@Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(FilesInterceptor('images')) // Add this to handle file upload
  async createProduct(
    @Body() productData: ProductDto, 
    @Request() req,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif)$/ }),
        ],
        fileIsRequired: false, // Make file optional
      })
    ) files?: Express.Multer.File[] // Add this parameter to receive the uploaded file
  ) {
    const userId = req.user?.id;
    console.log('User ID from token:', userId);
console.log('Uploaded files:', files && files.length > 0 ? files.map(f => f.originalname) : 'No files uploaded');
    
    return this.productService.createProduct(productData, userId , files);
  }

  @Get()
  async getAllProducts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return await this.productService.getAllProducts(page, limit);
  }

  /**
   * Advanced search endpoint with filters, sorting, and pagination
   * 🚀 ENTERPRISE GRADE - Uses V2 service with caching, metrics, and fault tolerance
   * 
   * @route GET /products/search
   * @query q - Search query (optional)
   * @query category - Filter by category (optional)
   * @query minPrice - Minimum price filter (optional)
   * @query maxPrice - Maximum price filter (optional)
   * @query condition - Filter by condition (optional)
   * @query tags - Comma-separated tags (optional)
   * @query inStock - Filter in-stock products only (optional)
   * @query sortBy - Sort order: relevance|price-asc|price-desc|newest|popular (optional, default: relevance)
   * @query page - Page number (optional, default: 1)
   * @query limit - Results per page (optional, default: 20)
   * @query cacheable - Enable/disable caching (optional, default: true)
   * @returns Paginated search results with filters and metadata
   */
  @Get('search')
  async searchProducts(
    @Query('q') query: string = '',
    @Query('category') category?: string,
    @Query('minPrice', new DefaultValuePipe(undefined)) minPrice?: number,
    @Query('maxPrice', new DefaultValuePipe(undefined)) maxPrice?: number,
    @Query('condition') condition?: string,
    @Query('tags') tags?: string,
    @Query('inStock') inStock?: string,
    @Query('sortBy', new DefaultValuePipe('relevance')) sortBy?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    @Query('cacheable', new DefaultValuePipe('true')) cacheable?: string,
  ) {
    const filters: any = {};
    
    if (category) filters.category = category;
    if (minPrice !== undefined) filters.minPrice = Number(minPrice);
    if (maxPrice !== undefined) filters.maxPrice = Number(maxPrice);
    if (condition) filters.condition = condition;
    if (tags) filters.tags = tags.split(',').map(t => t.trim());
    if (inStock === 'true') filters.inStock = true;

    const options = {
      page,
      limit: Math.min(limit, 100), // Max 100 per page
      sortBy: sortBy as any,
      cacheable: cacheable !== 'false', // Allow cache bypass
    };

    // Use V2 enterprise-grade search service
    return await this.searchProductsServiceV2.searchProducts(query, filters, options);
  }

  /**
   * Get autocomplete suggestions
   * 🚀 ENTERPRISE GRADE - Cached with Redis for ultra-fast response
   * 
   * @route GET /products/search/autocomplete
   * @query q - Search query
   * @query limit - Number of suggestions (optional, default: 5)
   */
  @Get('search/autocomplete')
  async getAutocompleteSuggestions(
    @Query('q') query: string,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number = 5,
  ) {
    if (!query || query.trim().length < 2) {
      return { suggestions: [] };
    }
    
    // Use V2 service with caching
    const suggestions = await this.searchProductsServiceV2.getAutocompleteSuggestions(
      query,
      Math.min(limit, 10), // Max 10 suggestions
    );
    
    return { suggestions };
  }

  /**
   * Get trending searches
   * 🚀 ENTERPRISE GRADE - Cached with 30-minute TTL
   * 
   * @route GET /products/search/trending
   * @query limit - Number of trending items (optional, default: 10)
   */
  @Get('search/trending')
  async getTrendingSearches(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    // Use V2 service with caching
    const trending = await this.searchProductsServiceV2.getTrendingSearches(
      Math.min(limit, 20), // Max 20 trending items
    );
    
    return { trending };
  }

  @Get('category/:category')
  async getProductsByCategory(
    @Param('category') category: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return await this.productService.getProductsByCategory(category, page, limit);
  }

  /**
   * Get all products for the authenticated user
   * @route GET /products/user/me
   * @auth Required - Uses JWT from cookies
   * @returns Array of products owned by the authenticated user
   */
  @Get('user/me')
  @UseGuards(AuthGuard)
  async getMyProducts(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    const userId = req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    console.log(`📦 Fetching products for user ID: ${userId}`);
    return await this.productService.getProductsByUserId(userId, page, limit);
  }

  @Get('user/:userId')
  async getProductsByUserId(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return await this.productService.getProductsByUserId(userId, page, limit);
  }

  /**
   * Get flash sales products (30-70% discount, refreshed hourly)
   * @route GET /products/flash-sales
   * @returns Flash sale products with next refresh time and countdown
   */
  @Get('flash-sales')
  async getFlashSales() {
    return await this.flashSalesService.getFlashSales();
  }

  @Get(':id')
  async getProductById(@Param('id', ParseIntPipe) productId: number) {
    return await this.productService.getProductById(productId);
  }


  @Put(':id')
  @UseGuards(AuthGuard)
  async updateProduct(
    @Param('id') id: string, 
    @Body() productData: ProductDto, 
    @Request() req
  ) {
    const userId = req.user?.id;
    return this.productService.updateProduct(+id, productData, userId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteProduct(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id;
    return this.productService.deleteProduct(+id, userId);
  }

  /**
   * Sync all products to MeiliSearch
   * @route POST /products/sync/meilisearch
   * @auth Optional - Can be protected with admin guard
   */
  @Post('sync/meilisearch')
  async syncToMeiliSearch() {
    // Get all products without pagination for sync
    const result = await this.productService.getAllProducts(1, 10000);
    const products = result.data;
    
    await this.meilisearchService.syncAllProducts(products);
    
    return {
      success: true,
      message: `Successfully synced ${products.length} products to MeiliSearch`,
      count: products.length,
    };
  }

  /**
   * Get MeiliSearch index statistics
   * @route GET /products/search/stats
   */
  @Get('search/stats')
  async getSearchStats() {
    const stats = await this.meilisearchService.getIndexStats();
    return stats;
  }

  /**
   * Force refresh flash sales (admin/testing)
   * @route POST /products/flash-sales/refresh
   */
  @Post('flash-sales/refresh')
  async refreshFlashSales() {
    return await this.flashSalesService.forceRefresh();
  }
}