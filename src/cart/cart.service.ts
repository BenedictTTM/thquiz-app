import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto, UpdateCartItemDto, MergeCartDto } from './dto';

/**
 * CartService
 * 
 * Enterprise-grade shopping cart service following SOLID principles and best practices.
 * Handles all cart operations with proper error handling, transaction safety, and validation.
 * 
 * @class
 * @since 1.0.0
 */
@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add a product to the user's cart.
   * 
   * IMPORTANT: Adding to cart does NOT reduce available stock.
   * Stock is only decremented during order placement/checkout.
   * This follows e-commerce best practices where cart is temporary/non-binding.
   * 
   * Creates a new cart if the user doesn't have one.
   * Updates quantity if product already exists in cart.
   * Validates product existence only - stock validation happens at checkout.
   * 
   * Stock Management Strategy:
   * - Cart Addition: Soft validation (allows exceeding stock temporarily)
   * - Checkout: Hard validation (enforces stock limits)
   * - Order Placement: Actual stock reduction
   * 
   * Rationale:
   * - Users may abandon carts (80% cart abandonment rate)
   * - Stock should not be locked for abandoned items
   * - Race conditions: Multiple users can explore same products
   * - Better UX: Users can add items and adjust at checkout
   * 
   * @param userId - The authenticated user's ID
   * @param addToCartDto - Product ID and quantity to add
   * @returns The updated cart with all items, product details, and stock warnings
   * @throws {NotFoundException} If product doesn't exist or is deleted
   * @throws {BadRequestException} If invalid quantity (< 1)
   * @throws {InternalServerErrorException} If database operation fails
   * 
   * @example
   * ```typescript
   * const cart = await cartService.addToCart(1, { productId: 5, quantity: 2 });
   * // Cart item added - stock validation deferred to checkout
   * ```
   */
  async addToCart(userId: number, addToCartDto: AddToCartDto) {
    const { productId, quantity } = addToCartDto;

    // Validate quantity is positive
    if (quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    try {
      // Validate product exists (but don't enforce stock limits)
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { 
          id: true, 
          title: true, 
          stock: true, 
          originalPrice: true, 
          discountedPrice: true,
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      this.logger.log(
        `🛒 Adding product ${productId} (${product.title}) - Qty: ${quantity}, Available Stock: ${product.stock}`
      );

      // Use transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Get or create cart
        let cart = await tx.cart.findUnique({
          where: { userId },
          include: { items: true },
        });

        if (!cart) {
          this.logger.log(`📦 Creating new cart for user ${userId}`);
          cart = await tx.cart.create({
            data: { userId },
            include: { items: true },
          });
        }

        // Check if product already in cart
        const existingItem = await tx.cartItem.findUnique({
          where: {
            cartId_productId: {
              cartId: cart.id,
              productId,
            },
          },
        });

        let finalQuantity: number;

        if (existingItem) {
          // Update existing item quantity
          finalQuantity = existingItem.quantity + quantity;

          this.logger.log(
            `✏️ Updating cart item: ${existingItem.quantity} → ${finalQuantity}`
          );

          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: finalQuantity },
          });
        } else {
          // Create new cart item
          finalQuantity = quantity;

          this.logger.log(`➕ Creating new cart item with quantity ${finalQuantity}`);

          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId,
              quantity: finalQuantity,
            },
          });
        }

        // Log stock warning if quantity exceeds available stock
        if (finalQuantity > product.stock) {
          this.logger.warn(
            `⚠️ Cart quantity (${finalQuantity}) exceeds available stock (${product.stock}) for product ${productId}. ` +
            `User will be notified at checkout.`
          );
        }

        // Return updated cart with full details
        return tx.cart.findUnique({
          where: { id: cart.id },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    originalPrice: true,
                    discountedPrice: true,
                    imageUrl: true,
                    stock: true,
                  },
                },
              },
            },
          },
        });
      });

      this.logger.log(`✅ Cart updated successfully for user ${userId}`);
      return this.formatCartResponse(result);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`💥 Failed to add item to cart:`, error.message);
      throw new InternalServerErrorException(
        'Failed to add item to cart',
        error.message,
      );
    }
  }

  /**
   * Get the user's cart with all items and calculated totals.
   * 
   * Returns null if user has no cart yet.
   * Includes product details, subtotal, and total item count.
   * 
   * @param userId - The authenticated user's ID
   * @returns The cart with items and totals, or null if no cart exists
   * @throws {InternalServerErrorException} If database operation fails
   * 
   * @example
   * ```typescript
   * const cart = await cartService.getCart(1);
   * if (cart) {
   *   console.log(`Total: GHS ${cart.subtotal}`);
   * }
   * ```
   */
  async getCart(userId: number) {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  originalPrice: true,
                  discountedPrice: true,
                  imageUrl: true,
                  stock: true,
                },
              },
            },
          },
        },
      });

      if (!cart) {
        return null;
      }

      return this.formatCartResponse(cart);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to retrieve cart',
        error.message,
      );
    }
  }

  /**
   * Update the quantity of a specific cart item.
   * 
   * IMPORTANT: Updating cart quantity does NOT validate stock limits.
   * Stock validation occurs at checkout to prevent poor UX.
   * This allows users to freely adjust cart quantities.
   * 
   * Allows any positive quantity - stock validation deferred to checkout.
   * Removes item if quantity is set to 0.
   * 
   * Enterprise Pattern:
   * - Cart is a "wishlist" until checkout
   * - No stock locking during cart operations
   * - Frontend can show stock warnings, but doesn't block
   * - Backend validates stock only during order placement
   * 
   * @param userId - The authenticated user's ID
   * @param itemId - The cart item ID to update
   * @param updateCartItemDto - New quantity value
   * @returns The updated cart with all items and totals
   * @throws {NotFoundException} If cart item doesn't exist or doesn't belong to user
   * @throws {BadRequestException} If quantity is negative
   * @throws {InternalServerErrorException} If database operation fails
   * 
   * @example
   * ```typescript
   * const cart = await cartService.updateCartItem(1, 5, { quantity: 3 });
   * ```
   */
  async updateCartItem(
    userId: number,
    itemId: number,
    updateCartItemDto: UpdateCartItemDto,
  ) {
    const { quantity } = updateCartItemDto;

    // Validate quantity is non-negative
    if (quantity < 0) {
      throw new BadRequestException('Quantity cannot be negative');
    }

    try {
      // Verify item exists and belongs to user's cart
      const cartItem = await this.prisma.cartItem.findUnique({
        where: { id: itemId },
        include: {
          cart: { select: { userId: true, id: true } },
          product: { select: { stock: true, title: true, id: true } },
        },
      });

      if (!cartItem || cartItem.cart.userId !== userId) {
        throw new NotFoundException('Cart item not found');
      }

      this.logger.log(
        `🛒 Updating cart item ${itemId}: ${cartItem.quantity} → ${quantity}`
      );

      // If quantity is 0, remove the item
      if (quantity === 0) {
        this.logger.log(`🗑️ Removing cart item ${itemId} (quantity set to 0)`);
        await this.prisma.cartItem.delete({
          where: { id: itemId },
        });
      } else {
        // Update quantity (no stock validation)
        await this.prisma.cartItem.update({
          where: { id: itemId },
          data: { quantity },
        });

        // Log warning if exceeds stock
        if (quantity > cartItem.product.stock) {
          this.logger.warn(
            `⚠️ Cart item quantity (${quantity}) exceeds available stock (${cartItem.product.stock}) ` +
            `for product ${cartItem.product.id}. Stock validation will occur at checkout.`
          );
        }
      }

      // Return updated cart
      return this.getCart(userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`💥 Failed to update cart item:`, error.message);
      throw new InternalServerErrorException(
        'Failed to update cart item',
        error.message,
      );
    }
  }

  /**
   * Remove a specific item from the cart.
   * 
   * Verifies the item belongs to the user's cart before deletion.
   * 
   * @param userId - The authenticated user's ID
   * @param itemId - The cart item ID to remove
   * @returns The updated cart after removal, or null if cart becomes empty
   * @throws {NotFoundException} If cart item doesn't exist or doesn't belong to user
   * @throws {InternalServerErrorException} If database operation fails
   * 
   * @example
   * ```typescript
   * await cartService.removeCartItem(1, 5);
   * ```
   */
  async removeCartItem(userId: number, itemId: number) {
    try {
      // Verify item exists and belongs to user's cart
      const cartItem = await this.prisma.cartItem.findUnique({
        where: { id: itemId },
        include: {
          cart: { select: { userId: true } },
        },
      });

      if (!cartItem || cartItem.cart.userId !== userId) {
        throw new NotFoundException('Cart item not found');
      }

      // Delete the item
      await this.prisma.cartItem.delete({
        where: { id: itemId },
      });

      // Return updated cart
      return this.getCart(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to remove cart item',
        error.message,
      );
    }
  }

  /**
   * Clear all items from the user's cart.
   * 
   * Removes all cart items but keeps the cart entity.
   * Useful for post-checkout cleanup.
   * 
   * @param userId - The authenticated user's ID
   * @returns The empty cart
   * @throws {NotFoundException} If user has no cart
   * @throws {InternalServerErrorException} If database operation fails
   * 
   * @example
   * ```typescript
   * await cartService.clearCart(1);
   * ```
   */
  async clearCart(userId: number) {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      // Delete all items in the cart
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      // Return empty cart
      return this.getCart(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to clear cart',
        error.message,
      );
    }
  }

  /**
   * Get the total count of items in the user's cart.
   * 
   * Useful for displaying cart badge in header.
   * Returns 0 if no cart exists.
   * 
   * @param userId - The authenticated user's ID
   * @returns The total quantity of all items in cart
   * @throws {InternalServerErrorException} If database operation fails
   * 
   * @example
   * ```typescript
   * const itemCount = await cartService.getCartItemCount(1);
   * // Display badge: <Badge>{itemCount}</Badge>
   * ```
   */
  async getCartItemCount(userId: number): Promise<number> {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            select: { quantity: true },
          },
        },
      });

      if (!cart) {
        return 0;
      }

      return cart.items.reduce((total, item) => total + item.quantity, 0);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to get cart item count',
        error.message,
      );
    }
  }

  /**
   * Merge anonymous cart items with authenticated user's cart.
   * 
   * IMPORTANT: Cart merge does NOT enforce stock limits.
   * This follows the same pattern as addToCart - stock validation at checkout only.
   * 
   * Called after user login/signup to preserve cart items added while anonymous.
   * Intelligently combines quantities for duplicate products.
   * Validates product existence but not stock availability.
   * Uses database transaction to ensure atomicity.
   * 
   * Merge Logic:
   * - If product already in user cart: Add quantities together
   * - If product not in cart: Add as new item
   * - No stock validation (deferred to checkout)
   * - All operations are atomic (succeed or fail together)
   * 
   * Enterprise Best Practice:
   * - Allow users to merge carts freely
   * - Show stock warnings in UI, but don't block merge
   * - Validate stock only when user attempts checkout
   * - Better conversion rates by reducing friction
   * 
   * @param userId - The authenticated user's ID
   * @param mergeCartDto - Array of cart items from local storage
   * @returns The merged cart with all items, stock status, and updated totals
   * @throws {NotFoundException} If any product doesn't exist
   * @throws {BadRequestException} If invalid quantities
   * @throws {InternalServerErrorException} If database operation fails
   * 
   * @example
   * ```typescript
   * // User had 2 items in anonymous cart, logs in, and cart has 1 existing item
   * const mergedCart = await cartService.mergeCart(1, {
   *   items: [
   *     { productId: 1, quantity: 2 },
   *     { productId: 5, quantity: 1 }
   *   ]
   * });
   * // Result: Cart with 3 items total (existing + new)
   * // Stock validation happens at checkout, not merge
   * ```
   */
  async mergeCart(userId: number, mergeCartDto: MergeCartDto) {
    const { items } = mergeCartDto;

    this.logger.log(`🔄 Starting cart merge for user ${userId} with ${items.length} items`);

    // Validate all quantities are positive
    const invalidItems = items.filter(item => item.quantity < 1);
    if (invalidItems.length > 0) {
      throw new BadRequestException(
        `Invalid quantities detected. All quantities must be at least 1.`
      );
    }

    try {
      // Use transaction to ensure all operations succeed or fail together
      const result = await this.prisma.$transaction(async (tx) => {
        // Step 1: Get or create user's cart
        let cart = await tx.cart.findUnique({
          where: { userId },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    title: true,
                    stock: true,
                    originalPrice: true,
                    discountedPrice: true,
                  },
                },
              },
            },
          },
        });

        if (!cart) {
          this.logger.log(`📦 Creating new cart for user ${userId}`);
          cart = await tx.cart.create({
            data: { userId },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      title: true,
                      stock: true,
                      originalPrice: true,
                      discountedPrice: true,
                    },
                  },
                },
              },
            },
          });
        } else {
          this.logger.log(`📦 Found existing cart ${cart.id} with ${cart.items.length} items`);
        }

        // Step 2: Validate all products exist (but don't check stock)
        const productIds = items.map((item) => item.productId);
        const products = await tx.product.findMany({
          where: {
            id: { in: productIds },
          },
          select: {
            id: true,
            title: true,
            stock: true,
            originalPrice: true,
            discountedPrice: true,
          },
        });

        // Check if all products exist
        if (products.length !== items.length) {
          const foundIds = products.map((p) => p.id);
          const missingIds = productIds.filter((id) => !foundIds.includes(id));
          this.logger.error(`❌ Products not found: ${missingIds.join(', ')}`);
          throw new NotFoundException(
            `Products not found: ${missingIds.join(', ')}`,
          );
        }

        // Create a map for quick product lookup
        const productMap = new Map(products.map((p) => [p.id, p]));

        // Step 3: Process each item from anonymous cart
        const mergeResults: Array<{
          productId: number;
          action: 'added' | 'updated';
          oldQuantity?: number;
          newQuantity?: number;
          quantity?: number;
          stockWarning?: boolean;
          availableStock?: number;
        }> = [];

        for (const item of items) {
          const product = productMap.get(item.productId);
          
          if (!product) {
            throw new NotFoundException(
              `Product with ID ${item.productId} not found`,
            );
          }

          // Check if product already exists in user's cart
          const existingCartItem = cart.items.find(
            (cartItem) => cartItem.product.id === item.productId,
          );

          if (existingCartItem) {
            // Product exists: Merge quantities (no stock validation)
            const newQuantity = existingCartItem.quantity + item.quantity;

            // Update existing cart item
            await tx.cartItem.update({
              where: { id: existingCartItem.id },
              data: { quantity: newQuantity },
            });

            this.logger.log(
              `✏️ Updated product ${product.id}: ${existingCartItem.quantity} → ${newQuantity}`
            );

            // Check if exceeds stock (warning only, doesn't block)
            const stockWarning = newQuantity > product.stock;
            if (stockWarning) {
              this.logger.warn(
                `⚠️ Merged quantity (${newQuantity}) exceeds available stock (${product.stock}) for "${product.title}". ` +
                `User will be notified at checkout.`
              );
            }

            mergeResults.push({
              productId: product.id,
              action: 'updated',
              oldQuantity: existingCartItem.quantity,
              newQuantity,
              stockWarning,
              availableStock: product.stock,
            });
          } else {
            // Product doesn't exist: Add as new item (no stock validation)
            
            // Create new cart item
            await tx.cartItem.create({
              data: {
                cartId: cart.id,
                productId: item.productId,
                quantity: item.quantity,
              },
            });

            this.logger.log(
              `➕ Added new product ${product.id} with quantity ${item.quantity}`
            );

            // Check if exceeds stock (warning only)
            const stockWarning = item.quantity > product.stock;
            if (stockWarning) {
              this.logger.warn(
                `⚠️ Added quantity (${item.quantity}) exceeds available stock (${product.stock}) for "${product.title}". ` +
                `User will be notified at checkout.`
              );
            }

            mergeResults.push({
              productId: product.id,
              action: 'added',
              quantity: item.quantity,
              stockWarning,
              availableStock: product.stock,
            });
          }
        }

        // Log merge summary
        const addedCount = mergeResults.filter((r) => r.action === 'added').length;
        const updatedCount = mergeResults.filter((r) => r.action === 'updated').length;
        const warningCount = mergeResults.filter((r) => r.stockWarning).length;
        
        this.logger.log(
          `✅ Merge complete: ${addedCount} items added, ${updatedCount} items updated` +
          (warningCount > 0 ? `, ${warningCount} stock warnings` : '')
        );

        // Step 4: Fetch and return the complete merged cart
        return tx.cart.findUnique({
          where: { id: cart.id },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    originalPrice: true,
                    discountedPrice: true,
                    imageUrl: true,
                    stock: true,
                    condition: true,
                    category: true,
                  },
                },
              },
            },
          },
        });
      });

      this.logger.log(`🎉 Cart merge successful for user ${userId}`);
      return this.formatCartResponse(result);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      
      this.logger.error(`💥 Cart merge failed for user ${userId}:`, error.message);
      throw new InternalServerErrorException(
        'Failed to merge cart',
        error.message,
      );
    }
  }

  /**
   * Format cart response with calculated totals and stock availability.
   * 
   * Private helper method to ensure consistent response structure.
   * Calculates subtotal, applies discounts, and counts total items.
   * Includes stock availability warnings for frontend display.
   * 
   * Stock Status Flags:
   * - hasStockIssues: true if any item exceeds available stock
   * - Item-level flags: inStock, availableStock, exceedsStock
   * 
   * This allows frontend to:
   * - Display warning badges on cart items
   * - Show informative messages before checkout
   * - Disable checkout if stock insufficient
   * 
   * @private
   * @param cart - Raw cart data from database
   * @returns Formatted cart with totals and stock information
   */
  private formatCartResponse(cart: any) {
    if (!cart) return null;

    let hasStockIssues = false;

    const items = cart.items.map((item: any) => {
      // Use discountedPrice if available, otherwise use originalPrice
      const effectivePrice = item.product.discountedPrice || item.product.originalPrice;

      // Check stock availability
      const availableStock = item.product.stock || 0;
      const inStock = item.quantity <= availableStock;
      const exceedsStock = item.quantity > availableStock;

      if (exceedsStock) {
        hasStockIssues = true;
      }

      return {
        id: item.id,
        quantity: item.quantity,
        product: {
          ...item.product,
          // Include stock status for frontend
          stockStatus: {
            available: availableStock,
            inStock,
            exceedsStock,
            maxAvailable: exceedsStock ? availableStock : null,
          },
        },
        itemTotal: effectivePrice * item.quantity,
      };
    });

    const subtotal = items.reduce(
      (total: number, item: any) => total + item.itemTotal,
      0,
    );

    const totalItems = items.reduce(
      (total: number, item: any) => total + item.quantity,
      0,
    );

    return {
      id: cart.id,
      userId: cart.userId,
      items,
      subtotal: Number(subtotal.toFixed(2)),
      totalItems,
      hasStockIssues, // Global flag for frontend
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
