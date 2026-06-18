import { IsString, Length, Matches } from 'class-validator'

export class LoginDto {
  @IsString()
  @Matches(/^\+?[\d\s\-()]+$/, { message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' })
  phone!: string

  @IsString()
  @Length(6, 6, { message: 'PIN ต้องมี 6 หลัก' })
  pin!: string
}

export class ChangePinDto {
  @IsString() @Length(6, 6) currentPin!: string
  @IsString() @Length(6, 6) newPin!: string
  @IsString() @Length(6, 6) confirmPin!: string
}
