import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto, MergeCartDto } from './dto';
import { AuthGuard } from '../guards/auth.guard';

/**
 * CartController
 * 
 * RESTful API endpoints for shopping cart operations.
 * All endpoints require authentication via AuthGuard.
 * Follows HTTP best practices with proper status codes and error handling.
 * 
 * @route /cart
 * @class
 * @since 1.0.0
 */
@Controller('cart')
@UseGuards(AuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Add a product to the authenticated user's cart.
   * 
   * Creates a new cart if user doesn't have one.
   * Updates quantity if product already exists in cart.
   * 
   * @route POST /cart
   * @access Private
   * @param req - Express request object with authenticated user
   * @param addToCartDto - Product ID and quantity to add
   * @returns 201 - Cart with added item and updated totals
   * @returns 400 - Bad request (invalid data or insufficient stock)
   * @returns 401 - Unauthorized (not authenticated)
   * @returns 404 - Product not found
   * 
   * @example
   * POST /cart
   * Body: { "productId": 5, "quantity": 2 }
   * 
   * Response: {
   *   "id": 1,
   *   "userId": 1,
   *   "items": [...],
   *   "subtotal": 150.00,
   *   "totalItems": 5
   * }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addToCart(@Req() req: any, @Body() addToCartDto: AddToCartDto) {
    const userId = req.user.id;
    return this.cartService.addToCart(userId, addToCartDto);
  }

  /**
   * Get the authenticated user's cart.
   * 
   * Returns cart with all items, product details, and calculated totals.
   * Returns null if user has no cart yet.
   * 
   * @route GET /cart
   * @access Private
   * @param req - Express request object with authenticated user
   * @returns 200 - Cart with items and totals, or null
   * @returns 401 - Unauthorized (not authenticated)
   * 
   * @example
   * GET /cart
   * 
   * Response: {
   *   "id": 1,
   *   "userId": 1,
   *   "items": [
   *     {
   *       "id": 1,
   *       "quantity": 2,
   *       "product": { "id": 5, "name": "Product", "price": 50 },
   *       "itemTotal": 100.00
   *     }
   *   ],
   *   "subtotal": 100.00,
   *   "totalItems": 2
   * }
   */
  @Get()
  async getCart(@Req() req: any) {
    const userId = req.user.id;
    return this.cartService.getCart(userId);
  }

  /**
   * Get the total count of items in the user's cart.
   * 
   * Useful for displaying cart badge in header without fetching full cart.
   * Returns 0 if no cart exists.
   * 
   * @route GET /cart/count
   * @access Private
   * @param req - Express request object with authenticated user
   * @returns 200 - Object with count property
   * @returns 401 - Unauthorized (not authenticated)
   * 
   * @example
   * GET /cart/count
   * 
   * Response: { "count": 5 }
   */
  @Get('count')
  async getCartItemCount(@Req() req: any) {
    const userId = req.user.id;
    const count = await this.cartService.getCartItemCount(userId);
    return { count };
  }

  /**
   * Merge anonymous cart items with authenticated user's cart.
   * 
   * Called after user login/signup to preserve cart items added while browsing as guest.
   * Intelligently combines quantities for products already in cart.
   * Validates product existence and stock availability.
   * All operations are atomic (succeed or fail together).
   * 
   * Merge Behavior:
   * - Existing product in cart: Adds quantities together
   * - New product: Adds as new cart item
   * - Validates stock for all final quantities
   * - Returns complete merged cart
   * 
   * @route POST /cart/merge
   * @access Private (requires authentication)
   * @param req - Express request object with authenticated user
   * @param mergeCartDto - Array of cart items from local storage
   * @returns 200 - Merged cart with all items and updated totals
   * @returns 400 - Bad request (invalid data or insufficient stock)
   * @returns 401 - Unauthorized (not authenticated)
   * @returns 404 - One or more products not found
   * 
   * @example
   * POST /cart/merge
   * Body: {
   *   "items": [
   *     { "productId": 1, "quantity": 2 },
   *     { "productId": 5, "quantity": 1 }
   *   ]
   * }
   * 
   * Response: {
   *   "id": 1,
   *   "userId": 42,
   *   "items": [
   *     {
   *       "id": 1,
   *       "quantity": 3,  // Combined 1 existing + 2 new
   *       "product": {...},
   *       "itemTotal": 89.97
   *     },
   *     {
   *       "id": 2,
   *       "quantity": 1,  // New item
   *       "product": {...},
   *       "itemTotal": 29.99
   *     }
   *   ],
   *   "subtotal": 119.96,
   *   "totalItems": 4
   * }
   */
  @Post('merge')
  @HttpCode(HttpStatus.OK)
  async mergeCart(@Req() req: any, @Body() mergeCartDto: MergeCartDto) {
    const userId = req.user.id;
    return this.cartService.mergeCart(userId, mergeCartDto);
  }

  /**
   * Update the quantity of a specific cart item.
   * 
   * Validates stock availability before updating.
   * 
   * @route PATCH /cart/:itemId
   * @access Private
   * @param req - Express request object with authenticated user
   * @param itemId - Cart item ID to update
   * @param updateCartItemDto - New quantity value
   * @returns 200 - Updated cart with new totals
   * @returns 400 - Bad request (invalid quantity or insufficient stock)
   * @returns 401 - Unauthorized (not authenticated)
   * @returns 404 - Cart item not found or doesn't belong to user
   * 
   * @example
   * PATCH /cart/5
   * Body: { "quantity": 3 }
   * 
   * Response: {
   *   "id": 1,
   *   "userId": 1,
   *   "items": [...],
   *   "subtotal": 150.00,
   *   "totalItems": 5
   * }
   */
  @Patch(':itemId')
  async updateCartItem(
    @Req() req: any,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    const userId = req.user.id;
    return this.cartService.updateCartItem(userId, itemId, updateCartItemDto);
  }

  /**
   * Remove a specific item from the cart.
   * 
   * Permanently deletes the cart item.
   * 
   * @route DELETE /cart/:itemId
   * @access Private
   * @param req - Express request object with authenticated user
   * @param itemId - Cart item ID to remove
   * @returns 200 - Updated cart after removal
   * @returns 401 - Unauthorized (not authenticated)
   * @returns 404 - Cart item not found or doesn't belong to user
   * 
   * @example
   * DELETE /cart/5
   * 
   * Response: {
   *   "id": 1,
   *   "userId": 1,
   *   "items": [...],
   *   "subtotal": 100.00,
   *   "totalItems": 3
   * }
   */
  @Delete(':itemId')
  async removeCartItem(
    @Req() req: any,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    const userId = req.user.id;
    return this.cartService.removeCartItem(userId, itemId);
  }

  /**
   * Clear all items from the user's cart.
   * 
   * Removes all cart items but keeps the cart entity.
   * Useful for post-checkout cleanup.
   * 
   * @route DELETE /cart
   * @access Private
   * @param req - Express request object with authenticated user
   * @returns 200 - Empty cart
   * @returns 401 - Unauthorized (not authenticated)
   * @returns 404 - Cart not found
   * 
   * @example
   * DELETE /cart
   * 
   * Response: {
   *   "id": 1,
   *   "userId": 1,
   *   "items": [],
   *   "subtotal": 0,
   *   "totalItems": 0
   * }
   */
  @Delete()
  async clearCart(@Req() req: any) {
    const userId = req.user.id;
    return this.cartService.clearCart(userId);
  }
}
