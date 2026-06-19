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

  async findAll(propertyId: string, opts: {
    page?: number
    limit?: number
    search?: string
    nationality?: string
    blacklist?: boolean
    returning?: boolean
  } = {}) {
    const page = opts.page || 1
    const limit = opts.limit || 20
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { propertyId }
    if (opts.search) {
      where.OR = [
        { firstName: { contains: opts.search } },
        { lastName: { contains: opts.search } },
        { phone: { contains: opts.search } },
        { email: { contains: opts.search } },
      ]
    }
    if (opts.nationality) where.nationality = opts.nationality
    if (opts.blacklist) where.blacklistFlag = true
    // "Returning" = guests with more than one booking. Prisma can't filter by
    // relation count directly, so resolve the qualifying ids via groupBy first.
    if (opts.returning) {
      const grouped = await this.prisma.booking.groupBy({
        by: ['guestId'],
        where: { propertyId },
        _count: { _all: true },
        having: { guestId: { _count: { gt: 1 } } },
      })
      where.id = { in: grouped.map((g) => g.guestId) }
    }

    const [guests, total] = await Promise.all([
      this.prisma.guest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { bookings: true } } },
      }),
      this.prisma.guest.count({ where }),
    ])

    // Last visit (latest checked-out stay) and next visit (soonest upcoming stay)
    // for just this page of guests — two grouped queries, no N+1.
    const guestIds = guests.map((g) => g.id)
    // "Next visit" = a genuinely FUTURE reservation (from tomorrow on). Today's
    // arrivals/in-house belong to the bookings page, not the guest directory —
    // showing "จองถัดไป วันนี้" here was confusing.
    const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1)
    const [lastVisits, nextVisits] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['guestId'],
        where: { propertyId, guestId: { in: guestIds }, status: 'checked_out' },
        _max: { checkOutDate: true },
      }),
      this.prisma.booking.groupBy({
        by: ['guestId'],
        where: {
          propertyId,
          guestId: { in: guestIds },
          status: { notIn: ['cancelled', 'no_show', 'checked_out'] },
          checkInDate: { gte: tomorrow },
        },
        _min: { checkInDate: true },
      }),
    ])
    const lastMap = new Map(lastVisits.map((v) => [v.guestId, v._max.checkOutDate]))
    const nextMap = new Map(nextVisits.map((v) => [v.guestId, v._min.checkInDate]))

    return {
      guests: guests.map((g) => ({
        ...this.maskSensitive(g),
        stayCount: g._count.bookings,
        lastVisit: lastMap.get(g.id) ?? null,
        nextVisit: nextMap.get(g.id) ?? null,
      })),
      total,
      page,
      limit,
    }
  }

  async getNationalities(propertyId: string) {
    const rows = await this.prisma.guest.findMany({
      where: { propertyId, nationality: { not: null } },
      select: { nationality: true },
      distinct: ['nationality'],
      orderBy: { nationality: 'asc' },
    })
    return rows.map((r) => r.nationality).filter(Boolean)
  }

  async getStats(propertyId: string) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const [total, blacklist, newThisMonth, returningGrouped] = await Promise.all([
      this.prisma.guest.count({ where: { propertyId } }),
      this.prisma.guest.count({ where: { propertyId, blacklistFlag: true } }),
      this.prisma.guest.count({ where: { propertyId, createdAt: { gte: monthStart } } }),
      this.prisma.booking.groupBy({
        by: ['guestId'],
        where: { propertyId },
        _count: { _all: true },
        having: { guestId: { _count: { gt: 1 } } },
      }),
    ])
    return { total, blacklist, newThisMonth, returning: returningGrouped.length }
  }

  async findOne(id: string, viewSensitive = false, propertyId: string) {
    const guest = await this.prisma.guest.findFirst({ where: { id, propertyId } })
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
  }>, propertyId: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id } })
    if (!guest || guest.propertyId !== propertyId) throw new NotFoundException('ไม่พบข้อมูลลูกค้า')
    return this.prisma.guest.update({
      where: { id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
    })
  }

  async getBookingHistory(guestId: string, propertyId: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id: guestId }, select: { propertyId: true } })
    if (!guest || guest.propertyId !== propertyId) throw new NotFoundException('ไม่พบข้อมูลลูกค้า')
    return this.prisma.booking.findMany({
      where: { guestId, propertyId },
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
