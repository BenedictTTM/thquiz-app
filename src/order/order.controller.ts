import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AuthGuard } from '../guards/auth.guard';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * Create an order for a single product.
   * Body: { productId, quantity, whatsappNumber, callNumber, hall?, message? }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: any, @Body() dto: CreateOrderDto) {
    const userId = req.user.id;
    return this.orderService.createOrder(userId, dto);
  }

  /** Get orders where the authenticated user is the buyer */
  @Get()
  async myOrders(@Req() req: any) {
    const userId = req.user.id;
    return this.orderService.getBuyerOrders(userId);
  }

  /** Get orders where the authenticated user is the seller */
  @Get('seller')
  async sellerOrders(@Req() req: any) {
    const userId = req.user.id;
    return this.orderService.getSellerOrders(userId);
  }

  /** Get a single order by id (buyer or seller only) */
  @Get(':id')
  async getById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user.id;
    return this.orderService.getOrderById(userId, id);
  }
}
