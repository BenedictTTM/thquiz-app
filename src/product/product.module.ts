import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CrudService } from './Service/crud.products.service';
import { GetProductsService } from './Service/getproducts.service';
import { SearchProductsService } from './Service/search.products.service';
import { FlashSalesService } from './Service/flashsales.service';
import { CategoryProductsService } from './Service/category-products.service';
import { CategoryController } from './categories/category.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Adjust path as needed
import { AuthGuard } from '../guards/auth.guard'; // Adjust path as needed
import { RolesGuard } from '../guards/roles.guard'; // Adjust path as needed
import { AuthModule } from 'src/auth/auth.module'; // Adjust the import path as necessary
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module'; // Import CloudinaryModule if needed
import { MeiliSearchModule } from '../meilisearch/meilisearch.module';

@Module({
  imports: [PrismaModule, AuthModule, CloudinaryModule, MeiliSearchModule], // Import PrismaModule if your services use Prisma
  controllers: [ProductController, CategoryController],
  providers: [
    ProductService,
    CrudService,
    GetProductsService,
    SearchProductsService,
    FlashSalesService,
    CategoryProductsService,
    AuthGuard, 
    RolesGuard
  ],
  exports: [ProductService, CategoryProductsService] // Export if other modules need to use ProductService
})
export class ProductModule {}