import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from './decorators/current-user.decorator'
import { Request } from 'express'

class VerifyPhoneDto {
  phone: string
}

class LoginDto {
  phone: string
  pin: string
}

class ChangePinDto {
  currentPin: string
  newPin: string
  confirmPin: string
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('verify-phone')
  @HttpCode(200)
  async verifyPhone(@Body() dto: VerifyPhoneDto) {
    return this.authService.verifyPhone(dto.phone)
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString()
    return this.authService.login(dto.phone, dto.pin, ip)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-pin')
  @HttpCode(200)
  async changePin(@CurrentUser() user: JwtPayload, @Body() dto: ChangePinDto) {
    return this.authService.changePin(user.sub, dto.currentPin, dto.newPin, dto.confirmPin)
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: JwtPayload) {
    // JWT stateless logout - client discards token
    return { success: true, message: 'ออกจากระบบสำเร็จ' }
  }
}
