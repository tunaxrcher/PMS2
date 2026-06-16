import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findAll(propertyId: string, filters?: { zoneId?: string; roomTypeId?: string; status?: string }) {
    return this.prisma.room.findMany({
      where: {
        propertyId,
        active: true,
        ...(filters?.zoneId && { zoneId: filters.zoneId }),
        ...(filters?.roomTypeId && { roomTypeId: filters.roomTypeId }),
        ...(filters?.status && { currentStatus: filters.status }),
      },
      include: {
        roomType: true,
        zone: true,
      },
      orderBy: [{ roomNumber: 'asc' }],
    })
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { roomType: true, zone: true },
    })
    if (!room) throw new NotFoundException('ไม่พบห้อง')
    return room
  }

  async create(data: {
    propertyId: string
    roomTypeId: string
    zoneId?: string
    roomNumber: string
    roomName?: string
    floorNo?: string
    buildingName?: string
    maxOccupancy: number
  }) {
    return this.prisma.room.create({
      data,
      include: { roomType: true, zone: true },
    })
  }

  async update(id: string, data: Partial<{
    roomTypeId: string
    zoneId: string
    roomNumber: string
    roomName: string
    floorNo: string
    buildingName: string
    maxOccupancy: number
    active: boolean
  }>) {
    const room = await this.prisma.room.findUnique({ where: { id } })
    if (!room) throw new NotFoundException('ไม่พบห้อง')
    return this.prisma.room.update({ where: { id }, data, include: { roomType: true, zone: true } })
  }

  async updateStatus(id: string, status: string, changedBy: string, reason?: string) {
    const room = await this.prisma.room.findUnique({ where: { id } })
    if (!room) throw new NotFoundException('ไม่พบห้อง')

    const validStatuses = ['clean', 'dirty', 'occupied', 'cleaning', 'inspected', 'out_of_order', 'out_of_service']
    if (!validStatuses.includes(status)) throw new BadRequestException('สถานะไม่ถูกต้อง')

    await this.prisma.$transaction([
      this.prisma.room.update({ where: { id }, data: { currentStatus: status } }),
      this.prisma.roomStatusLog.create({
        data: {
          roomId: id,
          oldStatus: room.currentStatus,
          newStatus: status,
          reason,
          changedBy,
        },
      }),
    ])

    return this.prisma.room.findUnique({ where: { id }, include: { roomType: true, zone: true } })
  }

  async getStatusLogs(roomId: string) {
    return this.prisma.roomStatusLog.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  }

  // Get rooms for Grid: all rooms with their current booking in date range
  async getGrid(propertyId: string, from: string, to: string) {
    const rooms = await this.prisma.room.findMany({
      where: { propertyId, active: true },
      include: {
        roomType: true,
        zone: true,
        bookingRooms: {
          where: {
            checkInDate: { lte: new Date(to) },
            checkOutDate: { gte: new Date(from) },
            status: { notIn: ['cancelled'] },
          },
          include: {
            booking: {
              include: { guest: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: [{ zone: { sortOrder: 'asc' } }, { roomNumber: 'asc' }],
    })
    return rooms
  }
}
