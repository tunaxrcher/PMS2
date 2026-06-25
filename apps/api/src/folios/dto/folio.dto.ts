import { IsString, IsOptional, IsNumber, IsInt, IsDateString, Min } from 'class-validator'

export class AddChargeDto {
  @IsString() itemType!: string
  @IsString() description!: string
  @IsInt() @Min(1) quantity!: number
  @IsNumber() @Min(0) unitPrice!: number
  @IsDateString() serviceDate!: string
}

export class AddDiscountDto {
  @IsString() description!: string
  @IsNumber() @Min(0) amount!: number
  @IsDateString() serviceDate!: string
}

export class AddPaymentDto {
  @IsString() paymentMethod!: string
  @IsNumber() @Min(0.01) amount!: number
  @IsOptional() @IsString() referenceNo?: string
  @IsOptional() @IsString() slipUrl?: string
}

export class RefundPaymentDto {
  @IsNumber() @Min(0.01) amount!: number
  @IsString() reason!: string
}

export class VoidPaymentDto {
  @IsString() reason!: string
}

export class AddDepositDto {
  @IsNumber() @Min(0.01) amount!: number
  @IsString() depositType!: string
  @IsString() paymentMethod!: string
  @IsOptional() @IsString() referenceNo?: string
  @IsOptional() @IsString() remark?: string
}

export class RefundDepositDto {
  @IsString() reason!: string
}
