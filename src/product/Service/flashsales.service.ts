import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

export interface FlashSaleProduct {
  id: number;
  title: string;
  description: string | null;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  category: string;
  imageUrl: string[];
  stock: number;
  views: number;
  tags: string[];
  createdAt: Date;
  user: {
    id: number;
    username: string;
    storeName: string | null;
  };
}

export interface FlashSaleResponse {
  products: FlashSaleProduct[];
  nextRefreshAt: Date;
  refreshesIn: number; // milliseconds until next refresh
}

@Injectable()
export class FlashSalesService {
  private readonly logger = new Logger(FlashSalesService.name);
  private cachedFlashSales: FlashSaleProduct[] = [];
  private nextRefreshTime: Date;

  constructor(private prisma: PrismaService) {
    // Initialize on startup
    this.refreshFlashSales();
  }

  /**
   * Cron job that runs every hour to refresh flash sales
   * Runs at the start of every hour (0 minutes, 0 seconds)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyRefresh() {
    this.logger.log('🔄 Hourly flash sales refresh triggered');
    await this.refreshFlashSales();
  }

  /**
   * Calculate discount percentage
   */
  private calculateDiscount(originalPrice: number, discountedPrice: number): number {
    if (originalPrice <= 0) return 0;
    return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
  }

  /**
   * Refresh flash sales by fetching new products
   * 
   * PERFORMANCE OPTIMIZATIONS:
   * - Minimal field selection
   * - Indexed query (isActive, isSold, stock)
   * - Efficient filtering and transformation
   * - In-memory shuffle (fast)
   */
  async refreshFlashSales(): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.log('🔍 Fetching products for flash sales...');

      // OPTIMIZATION: Minimal field selection, indexed queries
      const products = await this.prisma.product.findMany({
        where: {
          isActive: true,
          isSold: false,
          stock: { gt: 0 },
          originalPrice: { gt: 0 },
          discountedPrice: { gt: 0 },
        },
        select: {
          id: true,
          title: true,
          description: true,
          originalPrice: true,
          discountedPrice: true,
          category: true,
          imageUrl: true,
          stock: true,
          views: true,
          tags: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
              storeName: true,
            },
          },
        },
        // OPTIMIZATION: Limit initial fetch to reduce memory
        take: 1000, // Process max 1000 products
        orderBy: {
          createdAt: 'desc', // Recent products more likely to be active
        },
      });

      // OPTIMIZATION: Single-pass filter + transform
      const eligibleProducts: FlashSaleProduct[] = [];
      
      for (const product of products) {
        const discountPercentage = this.calculateDiscount(
          product.originalPrice,
          product.discountedPrice,
        );
        
        // Filter inline to avoid double iteration
        if (discountPercentage >= 30 && discountPercentage <= 70) {
          eligibleProducts.push({
            ...product,
            discountPercentage,
          });
        }
      }

      this.logger.log(
        `✅ Found ${eligibleProducts.length} eligible products (from ${products.length} total)`,
      );

      // Shuffle and take 20 random products
      this.cachedFlashSales = this.shuffleArray(eligibleProducts).slice(0, 20);

      // Set next refresh time to the start of next hour
      this.nextRefreshTime = this.getNextHourStart();

      const duration = Date.now() - startTime;
      this.logger.log(
        `🎉 Flash sales refreshed | ${this.cachedFlashSales.length} products | ${duration}ms | Next: ${this.nextRefreshTime.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(`❌ Error refreshing flash sales: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current flash sales products
   */
  async getFlashSales(): Promise<FlashSaleResponse> {
    // If cache is empty, refresh
    if (this.cachedFlashSales.length === 0) {
      await this.refreshFlashSales();
    }

    const now = new Date();
    const refreshesIn = this.nextRefreshTime.getTime() - now.getTime();

    return {
      products: this.cachedFlashSales,
      nextRefreshAt: this.nextRefreshTime,
      refreshesIn: Math.max(0, refreshesIn),
    };
  }

  /**
   * Fisher-Yates shuffle algorithm for randomization
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get the start of the next hour
   */
  private getNextHourStart(): Date {
    const next = new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  /**
   * Manual refresh endpoint (for admin/testing purposes)
   */
  async forceRefresh(): Promise<FlashSaleResponse> {
    this.logger.log('🔄 Manual flash sales refresh triggered');
    await this.refreshFlashSales();
    return this.getFlashSales();
  }
}
