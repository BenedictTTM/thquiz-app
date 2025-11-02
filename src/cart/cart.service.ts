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
   * Creates a new cart if the user doesn't have one.
   * Updates quantity if product already exists in cart.
   * Validates product existence and stock availability.
   * 
   * @param userId - The authenticated user's ID
   * @param addToCartDto - Product ID and quantity to add
   * @returns The updated cart with all items and product details
   * @throws {NotFoundException} If product doesn't exist
   * @throws {BadRequestException} If insufficient stock or invalid quantity
   * @throws {InternalServerErrorException} If database operation fails
   * 
   * @example
   * ```typescript
   * const cart = await cartService.addToCart(1, { productId: 5, quantity: 2 });
   * ```
   */
  async addToCart(userId: number, addToCartDto: AddToCartDto) {
    const { productId, quantity } = addToCartDto;

    try {
      // Validate product exists and check stock
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, title: true, stock: true, originalPrice: true, discountedPrice: true },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      if (product.stock < quantity) {
        throw new BadRequestException(
          `Insufficient stock. Only ${product.stock} items available`,
        );
      }

      // Use transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Get or create cart
        let cart = await tx.cart.findUnique({
          where: { userId },
          include: { items: true },
        });

        if (!cart) {
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

        if (existingItem) {
          // Update existing item quantity
          const newQuantity = existingItem.quantity + quantity;

          if (product.stock < newQuantity) {
            throw new BadRequestException(
              `Cannot add ${quantity} more items. Only ${product.stock - existingItem.quantity} items available`,
            );
          }

          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQuantity },
          });
        } else {
          // Create new cart item
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId,
              quantity,
            },
          });
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

      return this.formatCartResponse(result);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
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
   * Validates stock availability before updating.
   * Automatically removes item if quantity is set to 0.
   * 
   * @param userId - The authenticated user's ID
   * @param itemId - The cart item ID to update
   * @param updateCartItemDto - New quantity value
   * @returns The updated cart with all items and totals
   * @throws {NotFoundException} If cart item doesn't exist or doesn't belong to user
   * @throws {BadRequestException} If insufficient stock
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

    try {
      // Verify item exists and belongs to user's cart
      const cartItem = await this.prisma.cartItem.findUnique({
        where: { id: itemId },
        include: {
          cart: { select: { userId: true, id: true } },
          product: { select: { stock: true, title: true } },
        },
      });

      if (!cartItem || cartItem.cart.userId !== userId) {
        throw new NotFoundException('Cart item not found');
      }

      // Validate stock
      if (cartItem.product.stock < quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${cartItem.product.title}. Only ${cartItem.product.stock} items available`,
        );
      }

      // Update quantity
      await this.prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      });

      // Return updated cart
      return this.getCart(userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
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
   * Called after user login/signup to preserve cart items added while anonymous.
   * Intelligently combines quantities for duplicate products.
   * Validates product existence and stock availability for all items.
   * Uses database transaction to ensure atomicity.
   * 
   * Merge Logic:
   * - If product already in user cart: Add quantities together
   * - If product not in cart: Add as new item
   * - Validates stock availability for final quantities
   * - All operations are atomic (succeed or fail together)
   * 
   * @param userId - The authenticated user's ID
   * @param mergeCartDto - Array of cart items from local storage
   * @returns The merged cart with all items and updated totals
   * @throws {NotFoundException} If any product doesn't exist
   * @throws {BadRequestException} If insufficient stock for any item
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
   * ```
   */
  async mergeCart(userId: number, mergeCartDto: MergeCartDto) {
    const { items } = mergeCartDto;

    this.logger.log(`🔄 Starting cart merge for user ${userId} with ${items.length} items`);

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

        // Step 2: Validate all products exist and have sufficient stock
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
            // Product exists: Merge quantities
            const newQuantity = existingCartItem.quantity + item.quantity;

            // Validate stock for combined quantity
            if (product.stock < newQuantity) {
              this.logger.error(
                `❌ Insufficient stock for ${product.title}: requested ${newQuantity}, available ${product.stock}`,
              );
              throw new BadRequestException(
                `Insufficient stock for "${product.title}". ` +
                `You already have ${existingCartItem.quantity} in cart, ` +
                `trying to add ${item.quantity} more, ` +
                `but only ${product.stock} available in total.`,
              );
            }

            // Update existing cart item
            await tx.cartItem.update({
              where: { id: existingCartItem.id },
              data: { quantity: newQuantity },
            });

            this.logger.log(
              `✏️ Updated product ${product.id}: ${existingCartItem.quantity} → ${newQuantity}`,
            );

            mergeResults.push({
              productId: product.id,
              action: 'updated',
              oldQuantity: existingCartItem.quantity,
              newQuantity,
            });
          } else {
            // Product doesn't exist: Add as new item
            
            // Validate stock for new item
            if (product.stock < item.quantity) {
              this.logger.error(
                `❌ Insufficient stock for ${product.title}: requested ${item.quantity}, available ${product.stock}`,
              );
              throw new BadRequestException(
                `Insufficient stock for "${product.title}". ` +
                `Requested ${item.quantity}, but only ${product.stock} available.`,
              );
            }

            // Create new cart item
            await tx.cartItem.create({
              data: {
                cartId: cart.id,
                productId: item.productId,
                quantity: item.quantity,
              },
            });

            this.logger.log(
              `➕ Added new product ${product.id} with quantity ${item.quantity}`,
            );

            mergeResults.push({
              productId: product.id,
              action: 'added',
              quantity: item.quantity,
            });
          }
        }

        // Log merge summary
        const addedCount = mergeResults.filter((r) => r.action === 'added').length;
        const updatedCount = mergeResults.filter((r) => r.action === 'updated').length;
        this.logger.log(
          `✅ Merge complete: ${addedCount} items added, ${updatedCount} items updated`,
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
   * Format cart response with calculated totals.
   * 
   * Private helper method to ensure consistent response structure.
   * Calculates subtotal, applies discounts, and counts total items.
   * 
   * @private
   * @param cart - Raw cart data from database
   * @returns Formatted cart with totals
   */
  private formatCartResponse(cart: any) {
    if (!cart) return null;

    const items = cart.items.map((item: any) => {
      // Use discountedPrice if available, otherwise use originalPrice
      const effectivePrice = item.product.discountedPrice || item.product.originalPrice;

      return {
        id: item.id,
        quantity: item.quantity,
        product: item.product,
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
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
