import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'

// In-memory PIN attempt tracker (replace with Redis in production)
const pinAttempts = new Map<string, { count: number; lockedUntil?: Date }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 5

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService
  ) {}

  async verifyPhone(phone: string): Promise<{ exists: boolean; mustChangePinOnLogin?: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { phone } })
    if (!user || !user.active) {
      throw new NotFoundException('ไม่พบผู้ใช้งานในระบบ')
    }
    return { exists: true, mustChangePinOnLogin: user.mustChangePinOnLogin }
  }

  async login(
    phone: string,
    pin: string,
    ipAddress?: string
  ): Promise<{
    accessToken: string
    refreshToken: string
    user: {
      id: string
      phone: string
      firstName: string
      lastName: string
      propertyId: string | null
      roles: string[]
      permissions: string[]
      mustChangePinOnLogin: boolean
    }
  }> {
    // Check server-side lockout
    const attemptKey = `pin:${phone}`
    const attempt = pinAttempts.get(attemptKey)
    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      const minutes = Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 60000)
      throw new ForbiddenException(`บัญชีถูกล็อคชั่วคราว กรุณารอ ${minutes} นาที`)
    }

    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    })

    if (!user || !user.active) {
      throw new UnauthorizedException('เบอร์โทรหรือ PIN ไม่ถูกต้อง')
    }

    const pinValid = await bcrypt.compare(pin, user.pinHash)
    if (!pinValid) {
      // Track failed attempts
      const curr = pinAttempts.get(attemptKey) || { count: 0 }
      curr.count += 1
      pinAttempts.set(attemptKey, curr)
      if (curr.count >= MAX_ATTEMPTS) {
        curr.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        curr.count = 0
        pinAttempts.set(attemptKey, curr)
        throw new ForbiddenException(`ใส่ PIN ผิด ${MAX_ATTEMPTS} ครั้ง บัญชีถูกล็อค ${LOCKOUT_MINUTES} นาที`)
      }
      const remaining = MAX_ATTEMPTS - curr.count
      throw new UnauthorizedException(`PIN ไม่ถูกต้อง — เหลืออีก ${remaining} ครั้ง`)
    }

    // Clear attempts on success
    pinAttempts.delete(attemptKey)

    const roles = user.userRoles.map((ur) => ur.role.name)
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code)
        )
      ),
    ]

    const payload = {
      sub: user.id,
      phone: user.phone,
      propertyId: user.propertyId,
      roles,
      permissions,
    }

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN') || '8h',
    })

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '30d',
    })

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        propertyId: user.propertyId,
        userId: user.id,
        action: 'LOGIN',
        entityType: 'user',
        entityId: user.id,
        ipAddress,
      },
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        propertyId: user.propertyId,
        roles,
        permissions,
        mustChangePinOnLogin: user.mustChangePinOnLogin,
      },
    }
  }

  async changePin(
    userId: string,
    currentPin: string,
    newPin: string,
    confirmPin?: string
  ): Promise<{ success: boolean }> {
    if (confirmPin && newPin !== confirmPin) {
      throw new BadRequestException('PIN ใหม่และยืนยัน PIN ไม่ตรงกัน')
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน')

    const valid = await bcrypt.compare(currentPin, user.pinHash)
    if (!valid) throw new BadRequestException('PIN ปัจจุบันไม่ถูกต้อง')

    if (newPin === '000000') {
      throw new BadRequestException('ไม่สามารถใช้ PIN เริ่มต้นได้')
    }

    const newHash = await bcrypt.hash(newPin, 10)
    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash: newHash, mustChangePinOnLogin: false },
    })

    await this.prisma.auditLog.create({
      data: {
        propertyId: user.propertyId,
        userId,
        action: 'CHANGE_PIN',
        entityType: 'user',
        entityId: userId,
      },
    })

    return { success: true }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        property: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    })

    if (!user) throw new UnauthorizedException()

    const roles = user.userRoles.map((ur) => ur.role.name)
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code)
        )
      ),
    ]

    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      propertyId: user.propertyId,
      property: user.property,
      roles,
      permissions,
      mustChangePinOnLogin: user.mustChangePinOnLogin,
    }
  }
}
