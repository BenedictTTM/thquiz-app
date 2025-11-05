import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}
  async createOrder(buyerId: number, dto: CreateOrderDto) {
    const { productId, quantity, whatsappNumber, callNumber, hall, message } = dto;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        userId: true,
        stock: true,
        isActive: true,
        isSold: true,
        originalPrice: true,
        discountedPrice: true,
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found or inactive');
    }

    if (product.userId === buyerId) {
      throw new ForbiddenException('You cannot order your own product');
    }

    if (product.isSold || product.stock <= 0) {
      throw new BadRequestException('Product is sold out');
    }

    if (quantity > product.stock) {
      throw new BadRequestException('Insufficient stock for requested quantity');
    }

    const unitPrice = product.discountedPrice ?? product.originalPrice;
    const totalAmount = unitPrice * quantity;

    // Use a transaction to ensure atomic stock decrement + order creation
    const [updatedProduct, order] = await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: product.id },
        data: {
          stock: { decrement: quantity },
          isSold: product.stock - quantity <= 0 ? true : product.isSold,
        },
      }),
      this.prisma.order.create({
        data: {
          buyerId,
          sellerId: product.userId,
          whatsappNumber,
          callNumber,
          hall,
          buyerMessage: message,
          status: 'PENDING',
          currency: 'GHS',
          totalAmount,
          items: {
            create: {
              productId: product.id,
              quantity,
              unitPrice,
              productName: product.title,
            },
          },
        },
        include: {
          items: true,
        },
      }),
    ]);

    return order;
  }

  async getBuyerOrders(userId: number) {
    return this.prisma.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { product: { select: { id: true, title: true, imageUrl: true } } },
        },
      },
    });
  }

  async getSellerOrders(userId: number) {
    return this.prisma.order.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { product: { select: { id: true, title: true, imageUrl: true } } },
        },
      },
    });
  }

  async getOrderById(userId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: { select: { id: true, title: true, imageUrl: true } } },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    return order;
  }
}
