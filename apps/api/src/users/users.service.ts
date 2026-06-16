import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'


@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(propertyId: string) {
    const users = await this.prisma.user.findMany({
      where: { propertyId },
      include: {
        userRoles: { include: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return users.map((u) => this.sanitize(u))
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    })
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน')
    return this.sanitize(user)
  }

  async create(data: {
    propertyId: string
    phone: string
    firstName: string
    lastName: string
    roleName: string
  }) {
    const existing = await this.prisma.user.findUnique({ where: { phone: data.phone } })
    if (existing) throw new ConflictException('เบอร์โทรนี้มีในระบบแล้ว')

    const role = await this.prisma.role.findUnique({ where: { name: data.roleName } })
    if (!role) throw new NotFoundException('ไม่พบ Role นี้')

    const defaultPin = '000000'
    const pinHash = await bcrypt.hash(defaultPin, 10)

    const user = await this.prisma.user.create({
      data: {
        propertyId: data.propertyId,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        pinHash,
        mustChangePinOnLogin: true,
        userRoles: { create: { roleId: role.id } },
      },
      include: { userRoles: { include: { role: true } } },
    })

    return this.sanitize(user)
  }

  async update(
    id: string,
    data: {
      firstName?: string
      lastName?: string
      active?: boolean
      roleName?: string
    }
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน')

    if (data.roleName) {
      const role = await this.prisma.role.findUnique({ where: { name: data.roleName } })
      if (!role) throw new NotFoundException('ไม่พบ Role นี้')
      await this.prisma.userRole.deleteMany({ where: { userId: id } })
      await this.prisma.userRole.create({ data: { userId: id, roleId: role.id } })
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        active: data.active,
      },
      include: { userRoles: { include: { role: true } } },
    })

    return this.sanitize(updated)
  }

  async resetPin(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน')
    const pinHash = await bcrypt.hash('000000', 10)
    await this.prisma.user.update({
      where: { id },
      data: { pinHash, mustChangePinOnLogin: true },
    })
    return { success: true }
  }

  private sanitize(user: { id: string; phone: string; firstName: string; lastName: string; propertyId: string | null; active: boolean; mustChangePinOnLogin: boolean; createdAt: Date; updatedAt: Date; userRoles?: { role: { name: string } }[] }) {
    const { userRoles, ...rest } = user as { userRoles?: { role: { name: string } }[] } & typeof user
    return {
      ...rest,
      roles: userRoles?.map((ur) => ur.role.name) ?? [],
    }
  }
}
