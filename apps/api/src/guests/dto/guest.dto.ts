import { IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator'

export class CreateGuestDto {
  @IsString() firstName!: string
  @IsString() lastName!: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() email?: string
  @IsOptional() @IsString() nationality?: string
  @IsOptional() @IsString() idType?: string
  @IsOptional() @IsString() idNumber?: string
  @IsOptional() @IsDateString() dateOfBirth?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() remark?: string
}

export class UpdateGuestDto {
  @IsOptional() @IsString() firstName?: string
  @IsOptional() @IsString() lastName?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() email?: string
  @IsOptional() @IsString() nationality?: string
  @IsOptional() @IsString() idType?: string
  @IsOptional() @IsString() idNumber?: string
  @IsOptional() @IsDateString() dateOfBirth?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() remark?: string
  @IsOptional() @IsBoolean() blacklistFlag?: boolean
}
