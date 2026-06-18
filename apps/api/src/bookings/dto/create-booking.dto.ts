import {
  IsString, IsOptional, IsInt, IsNumber, IsDateString, Min, Max,
  ValidateNested, IsObject,
} from 'class-validator'
import { Type } from 'class-transformer'

class NewGuestDto {
  @IsString() firstName!: string
  @IsString() lastName!: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() email?: string
  @IsOptional() @IsString() nationality?: string
  @IsOptional() @IsString() idType?: string
  @IsOptional() @IsString() idNumber?: string
}

export class CreateBookingDto {
  @IsOptional() @IsString() guestId?: string

  @IsOptional() @IsObject() @ValidateNested() @Type(() => NewGuestDto)
  newGuest?: NewGuestDto

  @IsString() roomTypeId!: string
  @IsDateString() checkInDate!: string
  @IsDateString() checkOutDate!: string

  @IsInt() @Min(1) @Max(20) adults!: number
  @IsInt() @Min(0) @Max(20) children!: number
  @IsNumber() @Min(0) rate!: number

  @IsOptional() @IsString() bookingSourceId?: string
  @IsOptional() @IsString() notes?: string
  @IsOptional() @IsString() packageName?: string
  @IsOptional() @IsString() packageNote?: string
  @IsOptional() @IsNumber() @Min(0) depositAmount?: number
  @IsOptional() @IsString() depositMethod?: string
  @IsOptional() @IsString() status?: string
}
