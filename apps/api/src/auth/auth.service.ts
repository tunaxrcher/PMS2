import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'

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
      throw new UnauthorizedException('เบอร์โทรหรือ PIN ไม่ถูกต้อง')
    }

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
    newPin: string
  ): Promise<{ success: boolean }> {
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
