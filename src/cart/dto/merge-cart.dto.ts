import { IsArray, ValidateNested, IsInt, IsPositive, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Item to be merged into user's cart
 * Represents a single product from anonymous cart
 */
export class MergeCartItemDto {
  /**
   * Product ID from anonymous cart
   * @example 5
   */
  @IsInt({ message: 'Product ID must be an integer' })
  @IsPositive({ message: 'Product ID must be positive' })
  @Type(() => Number)
  productId: number;

  /**
   * Quantity from anonymous cart
   * @example 2
   */
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Type(() => Number)
  quantity: number;
}

/**
 * DTO for merging anonymous cart with authenticated user cart
 * 
 * Used when a user logs in after adding items to cart as anonymous.
 * Validates array of cart items to be merged.
 * 
 * @example
 * ```json
 * {
 *   "items": [
 *     { "productId": 1, "quantity": 2 },
 *     { "productId": 5, "quantity": 1 }
 *   ]
 * }
 * ```
 */
export class MergeCartDto {
  /**
   * Array of cart items from local storage to merge
   * Each item contains productId and quantity
   */
  @IsArray({ message: 'Items must be an array' })
  @ArrayMinSize(1, { message: 'At least one item is required to merge' })
  @ValidateNested({ each: true })
  @Type(() => MergeCartItemDto)
  items: MergeCartItemDto[];
}
