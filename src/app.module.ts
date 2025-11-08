import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductModule } from './product/product.module'
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CartModule } from './cart/cart.module';
import { SearchModule } from './search/search.module';
import { PaymentModule } from './payment/payment.module';
import { SlotModule } from './slot/slot.module';
import { OrderModule } from './order/order.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigModule available globally
    }),
    ScheduleModule.forRoot(), // Enable cron jobs
    AuthModule,
    UserModule,
    PrismaModule,
    ProductModule,
    CloudinaryModule,
    CartModule,
    SearchModule, // PostgreSQL Full-Text Search
    PaymentModule,
    // Slot management
    SlotModule,
    // Orders
    OrderModule,
  ],
})
export class AppModule {}
