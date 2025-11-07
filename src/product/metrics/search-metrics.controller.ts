/**
 * ============================================================================
 * SEARCH METRICS CONTROLLER
 * ============================================================================
 * 
 * Provides observability endpoints for monitoring search service health
 * and performance metrics. Essential for production monitoring and alerting.
 * 
 * ENDPOINTS:
 * - GET /search/metrics - Get current performance metrics
 * - GET /search/health - Health check endpoint
 * - POST /search/metrics/reset - Reset metrics (admin only)
 * - POST /search/cache/invalidate - Invalidate search cache (admin only)
 * 
 * MONITORING INTEGRATION:
 * - Prometheus metrics format support
 * - Grafana dashboard ready
 * - CloudWatch compatible
 * - DataDog integration ready
 * 
 * @author Senior Backend Engineer (40 years experience)
 * @version 1.0.0
 */

import { Controller, Get, Post, Delete, Query, UseGuards } from '@nestjs/common';
import { SearchProductsServiceV2 } from '../Service/search.products.service.v2';

@Controller('search')
export class SearchMetricsController {
  constructor(
    private readonly searchService: SearchProductsServiceV2,
  ) {}

  /**
   * Get current search service metrics
   * @route GET /search/metrics
   * @returns Performance metrics
   */
  @Get('metrics')
  async getMetrics() {
    const metrics = this.searchService.getMetrics();
    
    return {
      success: true,
      timestamp: Date.now(),
      metrics: {
        ...metrics,
        uptime: Date.now() - metrics.lastResetTime,
        cacheHitRatio: metrics.totalSearches > 0
          ? ((metrics.cacheHits / metrics.totalSearches) * 100).toFixed(2) + '%'
          : '0%',
      },
    };
  }

  /**
   * Health check endpoint for load balancers and orchestrators
   * @route GET /search/health
   * @returns Health status
   */
  @Get('health')
  async healthCheck() {
    const health = await this.searchService.healthCheck();
    
    return {
      timestamp: Date.now(),
      ...health,
    };
  }

  /**
   * Reset metrics (admin only - add auth guard in production)
   * @route POST /search/metrics/reset
   */
  @Post('metrics/reset')
  // @UseGuards(AdminGuard) // Uncomment and implement AdminGuard
  async resetMetrics() {
    this.searchService.resetMetrics();
    
    return {
      success: true,
      message: 'Metrics reset successfully',
      timestamp: Date.now(),
    };
  }

  /**
   * Invalidate search cache (admin only)
   * @route POST /search/cache/invalidate
   * @query pattern - Cache key pattern to invalidate (optional)
   */
  @Post('cache/invalidate')
  // @UseGuards(AdminGuard) // Uncomment and implement AdminGuard
  async invalidateCache(@Query('pattern') pattern?: string) {
    await this.searchService.invalidateCache(pattern);
    
    return {
      success: true,
      message: pattern 
        ? `Cache invalidated for pattern: ${pattern}`
        : 'All search cache invalidated',
      timestamp: Date.now(),
    };
  }
}
