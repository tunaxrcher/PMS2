import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RoomTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll(propertyId: string) {
    return this.prisma.roomType.findMany({
      where: { propertyId, active: true },
      orderBy: { name: 'asc' },
    })
  }

  async findOne(id: string) {
    const rt = await this.prisma.roomType.findUnique({ where: { id } })
    if (!rt) throw new NotFoundException('ไม่พบประเภทห้อง')
    return rt
  }

  async create(data: {
    propertyId: string
    name: string
    description?: string
    baseOccupancy: number
    maxOccupancy: number
    baseRate: number
  }) {
    return this.prisma.roomType.create({ data })
  }

  async update(id: string, data: Partial<{
    name: string
    description: string
    imageUrl: string
    baseOccupancy: number
    maxOccupancy: number
    baseRate: number
    active: boolean
  }>) {
    const rt = await this.prisma.roomType.findUnique({ where: { id } })
    if (!rt) throw new NotFoundException('ไม่พบประเภทห้อง')
    return this.prisma.roomType.update({ where: { id }, data })
  }

  async remove(id: string) {
    const rooms = await this.prisma.room.count({ where: { roomTypeId: id } })
    if (rooms > 0) {
      return this.prisma.roomType.update({ where: { id }, data: { active: false } })
    }
    return this.prisma.roomType.delete({ where: { id } })
  }
}
