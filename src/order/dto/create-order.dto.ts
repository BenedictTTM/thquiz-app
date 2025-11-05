import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  @IsPositive()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  whatsappNumber: string;

  @IsString()
  @IsNotEmpty()
  callNumber: string;

  @IsString()
  @IsOptional()
  hall?: string;

  @IsString()
  @IsOptional()
  message?: string;
}
