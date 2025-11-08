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
  generation: number; // Track which batch this is
}

/**
 * Enterprise Flash Sales Service
 * 
 * ARCHITECTURE: Double-Buffer Pre-rendering
 * ==========================================
 * 
 * Problem: Traditional approach causes "flash sale gap" during refresh
 * Solution: Pre-render next batch 5 minutes before current expires
 * 
 * Design Pattern: Double Buffering (Graphics/Game Dev Pattern)
 * - Buffer A (Current): Actively served to users
 * - Buffer B (Next): Pre-rendered in background
 * - Atomic Swap: Zero-downtime transition at hour boundary
 * 
 * Benefits:
 * ✅ Zero perceived latency during rotation
 * ✅ No cache stampede (pre-warmed)
 * ✅ Graceful degradation on errors
 * ✅ Consistent response times
 * ✅ Production-ready for millions of requests
 * 
 * @class FlashSalesService
 * @since 2.0.0
 */
@Injectable()
export class FlashSalesService {
  private readonly logger = new Logger(FlashSalesService.name);
  
  // Double Buffer System
  private currentBatch: FlashSaleProduct[] = [];
  private nextBatch: FlashSaleProduct[] = [];
  
  // Metadata
  private currentRefreshTime: Date;
  private nextRefreshTime: Date;
  private generationCounter = 0;
  
  // Pre-rendering Control
  private isPrerendering = false;
  private readonly PRE_RENDER_MINUTES = 5; // Start preparing 5min before expiry
  
  constructor(private prisma: PrismaService) {
    // Initialize both buffers on startup
    this.initializeService();
  }

  /**
   * Initialize service on startup
   * Loads current batch immediately and schedules pre-rendering
   */
  private async initializeService() {
    this.logger.log('🚀 Initializing Flash Sales Service...');
    
    try {
      // Set initial timestamps
      this.currentRefreshTime = new Date();
      this.nextRefreshTime = this.getNextHourStart();
      
      // Load initial batch immediately
      await this.refreshCurrentBatch();
      
      // Pre-render next batch in background (don't wait)
      this.preRenderNextBatch().catch(err => 
        this.logger.error(`Failed to pre-render on init: ${err.message}`)
      );
      
      this.logger.log(
        `✅ Flash Sales initialized | Current batch: ${this.currentBatch.length} products | ` +
        `Next refresh: ${this.nextRefreshTime.toISOString()}`
      );
    } catch (error) {
      this.logger.error(`❌ Failed to initialize Flash Sales: ${error.message}`);
      // Set empty fallback
      this.currentBatch = [];
      this.nextBatch = [];
    }
  }

  /**
   * PRIMARY CRON: Runs every hour at HH:00:00 to swap buffers
   * This is instant because next batch is already pre-rendered
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlySwap() {
    this.logger.log('🔄 Hourly flash sales rotation triggered');
    await this.performBufferSwap();
  }

  /**
   * SECONDARY CRON: Runs at HH:55:00 to pre-render next batch
   * Gives 5 minutes for preparation before swap
   */
  @Cron('0 55 * * * *') // Every hour at 55 minutes
  async handlePreRender() {
    this.logger.log('⏰ Pre-render trigger (5min before swap)');
    await this.preRenderNextBatch();
  }

  /**
   * BACKUP CRON: Safety fallback every 5 minutes to check if refresh is needed
   * Only triggers if system missed the main cron jobs
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async handleSafetyCheck() {
    const now = new Date();
    const timeSinceRefresh = now.getTime() - this.currentRefreshTime?.getTime();
    
    // If more than 65 minutes since last refresh (missed cron), force refresh
    if (timeSinceRefresh > 65 * 60 * 1000) {
      this.logger.warn('⚠️ Safety check triggered - missed regular refresh');
      await this.performBufferSwap();
    }
  }

  /**
   * Perform atomic buffer swap (instant operation)
   * Current ← Next (pre-rendered batch becomes live)
   * Next ← Empty (ready for next pre-render)
   */
  private async performBufferSwap() {
    const startTime = Date.now();
    
    try {
      // Atomic swap - no database queries, instant
      if (this.nextBatch.length > 0) {
        this.currentBatch = this.nextBatch;
        this.nextBatch = [];
        this.generationCounter++;
        
        this.logger.log(
          `✅ Buffer swapped | Generation ${this.generationCounter} | ` +
          `${this.currentBatch.length} products now live | ${Date.now() - startTime}ms`
        );
      } else {
        this.logger.warn('⚠️ Next batch empty during swap, refreshing current batch instead');
        await this.refreshCurrentBatch();
      }
      
      // Update timestamps
      this.currentRefreshTime = new Date();
      this.nextRefreshTime = this.getNextHourStart();
      
      this.logger.log(`📅 Next refresh scheduled for: ${this.nextRefreshTime.toISOString()}`);
      
    } catch (error) {
      this.logger.error(`❌ Buffer swap failed: ${error.message}`);
      // Keep current batch active on error
    }
  }

  /**
   * Pre-render next batch in background
   * Runs 5 minutes before swap to ensure smooth transition
   */
  private async preRenderNextBatch() {
    if (this.isPrerendering) {
      this.logger.warn('⚠️ Pre-render already in progress, skipping');
      return;
    }

    this.isPrerendering = true;
    const startTime = Date.now();
    
    try {
      this.logger.log('🎨 Pre-rendering next flash sales batch...');
      
      const products = await this.fetchFlashSaleProducts();
      this.nextBatch = products;
      
      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Next batch pre-rendered | ${this.nextBatch.length} products ready | ` +
        `${duration}ms | Swap scheduled: ${this.nextRefreshTime.toISOString()}`
      );
      
    } catch (error) {
      this.logger.error(`❌ Pre-render failed: ${error.message}`);
      // Keep old next batch as fallback
    } finally {
      this.isPrerendering = false;
    }
  }

  /**
   * Refresh current batch (used on startup and emergency cases)
   */
  private async refreshCurrentBatch() {
    const startTime = Date.now();
    
    try {
      this.logger.log('🔄 Loading current flash sales batch...');
      
      const products = await this.fetchFlashSaleProducts();
      this.currentBatch = products;
      this.generationCounter++;
      
      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Current batch loaded | Generation ${this.generationCounter} | ` +
        `${this.currentBatch.length} products | ${duration}ms`
      );
      
    } catch (error) {
      this.logger.error(`❌ Failed to load current batch: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate discount percentage
   */
  private calculateDiscount(originalPrice: number, discountedPrice: number): number {
    if (originalPrice <= 0) return 0;
    return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
  }

  /**
   * Core method: Fetch and prepare flash sale products
   * Extracted for reusability (current batch + next batch)
   * 
   * PERFORMANCE OPTIMIZATIONS:
   * - Minimal field selection
   * - Indexed query (isActive, isSold, stock)
   * - Efficient filtering and transformation
   * - In-memory shuffle (fast)
   */
  private async fetchFlashSaleProducts(): Promise<FlashSaleProduct[]> {
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
      const selectedProducts = this.shuffleArray(eligibleProducts).slice(0, 20);

      const duration = Date.now() - startTime;
      this.logger.log(
        `🎉 Flash sales products prepared | ${selectedProducts.length} products | ${duration}ms`,
      );

      return selectedProducts;
    } catch (error) {
      this.logger.error(`❌ Error fetching flash sale products: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current flash sales products
   * Always serves from currentBatch (pre-rendered, instant response)
   */
  async getFlashSales(): Promise<FlashSaleResponse> {
    // If current batch is empty (shouldn't happen), try emergency refresh
    if (this.currentBatch.length === 0) {
      this.logger.warn('⚠️ Current batch empty, performing emergency refresh');
      await this.refreshCurrentBatch();
    }

    const now = new Date();
    const refreshesIn = this.nextRefreshTime.getTime() - now.getTime();

    return {
      products: this.currentBatch,
      nextRefreshAt: this.nextRefreshTime,
      refreshesIn: Math.max(0, refreshesIn),
      generation: this.generationCounter,
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
   * Forces immediate buffer swap with new products
   */
  async forceRefresh(): Promise<FlashSaleResponse> {
    this.logger.log('🔄 Manual flash sales refresh triggered');
    
    // Refresh both buffers
    await this.refreshCurrentBatch();
    await this.preRenderNextBatch();
    
    return this.getFlashSales();
  }
}
