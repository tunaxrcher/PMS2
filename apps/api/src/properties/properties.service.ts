import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.property.findMany({ orderBy: { name: 'asc' } })
  }

  async findOne(id: string) {
    const prop = await this.prisma.property.findUnique({ where: { id } })
    if (!prop) throw new NotFoundException('ไม่พบข้อมูลที่พัก')
    return prop
  }

  async update(id: string, data: Partial<{
    name: string
    address: string
    phone: string
    email: string
    timezone: string
    checkInTime: string
    checkOutTime: string
    vatRate: number
    serviceChargeRate: number
    priceIncludeTax: boolean
    active: boolean
  }>) {
    return this.prisma.property.update({ where: { id }, data })
  }
}
