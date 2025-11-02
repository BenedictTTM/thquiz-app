# Backend Cart Merge Endpoint Implementation Guide

## Required Endpoint

### POST `/cart/merge`

Merges anonymous cart items with authenticated user's cart after login/signup.

---

## Implementation Example (NestJS)

### 1. DTO (Data Transfer Object)

```typescript
// src/cart/dto/merge-cart.dto.ts
import { IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class CartItemDto {
  @IsInt()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class MergeCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}
```

### 2. Controller

```typescript
// src/cart/cart.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CartService } from './cart.service';
import { MergeCartDto } from './dto/merge-cart.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('merge')
  async mergeCart(
    @GetUser('id') userId: number,
    @Body() mergeCartDto: MergeCartDto,
  ) {
    return this.cartService.mergeCart(userId, mergeCartDto.items);
  }
}
```

### 3. Service Logic

```typescript
// src/cart/cart.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async mergeCart(
    userId: number,
    items: Array<{ productId: number; quantity: number }>,
  ) {
    // 1. Get or create user's cart
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId,
          items: { create: [] },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    }

    // 2. Merge items
    for (const item of items) {
      // Validate product exists
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );
      }

      // Check if item already exists in cart
      const existingItem = cart.items.find(
        (cartItem) => cartItem.product.id === item.productId,
      );

      if (existingItem) {
        // Update quantity (add to existing)
        const newQuantity = existingItem.quantity + item.quantity;

        // Validate stock
        if (product.stock !== null && newQuantity > product.stock) {
          throw new BadRequestException(
            `Insufficient stock for ${product.title}. Available: ${product.stock}`,
          );
        }

        await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
        });
      } else {
        // Add new item to cart
        if (product.stock !== null && item.quantity > product.stock) {
          throw new BadRequestException(
            `Insufficient stock for ${product.title}. Available: ${product.stock}`,
          );
        }

        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.productId,
            quantity: item.quantity,
          },
        });
      }
    }

    // 3. Fetch updated cart with all items
    const updatedCart = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 4. Calculate totals
    const subtotal = updatedCart.items.reduce((sum, item) => {
      const price = item.product.discountedPrice || item.product.originalPrice;
      return sum + price * item.quantity;
    }, 0);

    const totalItems = updatedCart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    // 5. Format and return response
    return {
      id: updatedCart.id,
      userId: updatedCart.userId,
      items: updatedCart.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          title: item.product.title,
          description: item.product.description,
          originalPrice: item.product.originalPrice,
          discountedPrice: item.product.discountedPrice,
          imageUrl: item.product.imageUrl,
          condition: item.product.condition,
          stock: item.product.stock,
          category: item.product.category,
          brand: item.product.brand,
          user: item.product.user,
        },
        itemTotal:
          (item.product.discountedPrice || item.product.originalPrice) *
          item.quantity,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      subtotal,
      totalItems,
      createdAt: updatedCart.createdAt,
      updatedAt: updatedCart.updatedAt,
    };
  }
}
```

---

## Alternative: Express.js Implementation

```typescript
// routes/cart.routes.ts
import express from 'express';
import { authenticate } from '../middleware/auth';
import { mergeCart } from '../controllers/cart.controller';

const router = express.Router();

router.post('/merge', authenticate, mergeCart);

export default router;
```

```typescript
// controllers/cart.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function mergeCart(req: Request, res: Response) {
  try {
    const userId = req.user.id; // From auth middleware
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'Items array required' });
    }

    // Get or create cart
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: { items: { include: { product: true } } },
      });
    }

    // Merge items
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return res
          .status(404)
          .json({ message: `Product ${item.productId} not found` });
      }

      const existingItem = cart.items.find(
        (ci) => ci.productId === item.productId,
      );

      if (existingItem) {
        // Update quantity
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + item.quantity },
        });
      } else {
        // Create new item
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.productId,
            quantity: item.quantity,
          },
        });
      }
    }

    // Fetch updated cart
    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    // Calculate totals
    const subtotal = updatedCart.items.reduce((sum, item) => {
      const price = item.product.discountedPrice || item.product.originalPrice;
      return sum + price * item.quantity;
    }, 0);

    res.json({
      ...updatedCart,
      subtotal,
      totalItems: updatedCart.items.reduce((sum, i) => sum + i.quantity, 0),
    });
  } catch (error) {
    console.error('Cart merge error:', error);
    res.status(500).json({ message: 'Failed to merge cart' });
  }
}
```

---

## Database Schema (Prisma)

```prisma
model Cart {
  id        Int        @id @default(autoincrement())
  userId    Int        @unique
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     CartItem[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model CartItem {
  id        Int      @id @default(autoincrement())
  cartId    Int
  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  quantity  Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([cartId, productId])
}
```

---

## Testing with cURL

```bash
# Merge cart (replace TOKEN with actual JWT)
curl -X POST http://localhost:3001/cart/merge \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "productId": 1, "quantity": 2 },
      { "productId": 5, "quantity": 1 }
    ]
  }'
```

---

## Error Handling

The endpoint should handle:

1. **Unauthorized** (401): No valid JWT token
2. **Bad Request** (400): Invalid data format
3. **Not Found** (404): Product doesn't exist
4. **Conflict** (409): Insufficient stock
5. **Server Error** (500): Database or unexpected errors

---

## Response Examples

### Success Response

```json
{
  "id": 1,
  "userId": 42,
  "items": [
    {
      "id": 1,
      "quantity": 3,
      "product": {
        "id": 1,
        "title": "iPhone 15 Pro",
        "originalPrice": 999.99,
        "discountedPrice": 899.99,
        "imageUrl": ["https://..."],
        "stock": 10
      },
      "itemTotal": 2699.97
    }
  ],
  "subtotal": 2699.97,
  "totalItems": 3,
  "createdAt": "2025-11-02T10:00:00.000Z",
  "updatedAt": "2025-11-02T10:35:00.000Z"
}
```

### Error Response

```json
{
  "message": "Product with ID 999 not found",
  "statusCode": 404
}
```

---

## Security Considerations

1. **Authentication Required**: Always validate JWT
2. **Validate Product IDs**: Ensure products exist
3. **Check Stock**: Prevent overselling
4. **Rate Limiting**: Prevent abuse
5. **Input Validation**: Use DTOs/validators

---

## Performance Optimization

1. **Batch Operations**: Use transactions for multiple items
2. **Caching**: Cache product lookups
3. **Eager Loading**: Include related data in queries
4. **Indexing**: Index userId, productId fields

---

**Implementation Priority:** High
**Difficulty:** Medium
**Time Estimate:** 2-3 hours
