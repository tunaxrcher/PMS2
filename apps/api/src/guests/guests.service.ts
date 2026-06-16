import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class GuestsService {
  constructor(private prisma: PrismaService) {}

  async search(propertyId: string, query: string) {
    return this.prisma.guest.findMany({
      where: {
        propertyId,
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { phone: { contains: query } },
          { email: { contains: query } },
        ],
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findAll(propertyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [guests, total] = await Promise.all([
      this.prisma.guest.findMany({
        where: { propertyId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.guest.count({ where: { propertyId } }),
    ])
    return { guests: guests.map((g) => this.maskSensitive(g)), total, page, limit }
  }

  async findOne(id: string, viewSensitive = false) {
    const guest = await this.prisma.guest.findUnique({ where: { id } })
    if (!guest) throw new NotFoundException('ไม่พบข้อมูลลูกค้า')
    return viewSensitive ? guest : this.maskSensitive(guest)
  }

  async create(data: {
    propertyId: string
    firstName: string
    lastName: string
    phone?: string
    email?: string
    nationality?: string
    idType?: string
    idNumber?: string
    dateOfBirth?: string
    address?: string
    remark?: string
  }) {
    return this.prisma.guest.create({ data: {
      ...data,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    }})
  }

  async update(id: string, data: Partial<{
    firstName: string
    lastName: string
    phone: string
    email: string
    nationality: string
    idType: string
    idNumber: string
    dateOfBirth: string
    address: string
    remark: string
    blacklistFlag: boolean
  }>) {
    const guest = await this.prisma.guest.findUnique({ where: { id } })
    if (!guest) throw new NotFoundException('ไม่พบข้อมูลลูกค้า')
    return this.prisma.guest.update({
      where: { id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
    })
  }

  async getBookingHistory(guestId: string) {
    return this.prisma.booking.findMany({
      where: { guestId },
      include: {
        bookingRooms: { include: { roomType: true, room: true } },
        bookingSource: true,
      },
      orderBy: { checkInDate: 'desc' },
      take: 10,
    })
  }

  private maskSensitive<T extends { idNumber?: string | null }>(guest: T): T {
    if (!guest.idNumber) return guest
    const masked = guest.idNumber.length > 4
      ? '*'.repeat(guest.idNumber.length - 4) + guest.idNumber.slice(-4)
      : '****'
    return { ...guest, idNumber: masked }
  }
}
