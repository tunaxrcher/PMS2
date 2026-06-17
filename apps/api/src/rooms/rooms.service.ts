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

  async removeRoom(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } })
    if (!room) throw new NotFoundException('ไม่พบห้อง')
    const hasBookings = await this.prisma.bookingRoom.count({
      where: { roomId: id, booking: { status: { in: ['confirmed', 'checked_in'] } } },
    })
    if (hasBookings > 0) {
      return this.prisma.room.update({ where: { id }, data: { active: false } })
    }
    return this.prisma.room.update({ where: { id }, data: { active: false } })
  }

  async addRoomImage(roomId: string, data: { url: string; caption?: string; isPrimary?: boolean; sortOrder?: number }) {
    if (data.isPrimary) {
      await this.prisma.roomImage.updateMany({ where: { roomId }, data: { isPrimary: false } })
    }
    return this.prisma.roomImage.create({ data: { roomId, ...data } })
  }

  async deleteRoomImage(imageId: string) {
    return this.prisma.roomImage.delete({ where: { id: imageId } })
  }

  async getRoomImages(roomId: string) {
    return this.prisma.roomImage.findMany({ where: { roomId }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] })
  }

  // Room Map: rooms grouped by zone with booking status for a date
  async getRoomMap(propertyId: string, date: string) {
    const targetDate = new Date(date)

    const zones = await this.prisma.zone.findMany({
      where: { propertyId, active: true },
      orderBy: { sortOrder: 'asc' },
    })

    const rooms = await this.prisma.room.findMany({
      where: { propertyId, active: true },
      include: {
        roomType: { select: { id: true, name: true, imageUrl: true, baseRate: true } },
        zone: { select: { id: true, name: true, imageUrl: true } },
        images: { where: { isPrimary: true }, take: 1 },
        bookingRooms: {
          where: {
            status: { notIn: ['cancelled'] },
            checkInDate: { lte: targetDate },
            checkOutDate: { gt: targetDate },
            booking: { propertyId, status: { notIn: ['cancelled', 'no_show'] } },
          },
          include: {
            booking: {
              include: {
                guest: { select: { firstName: true, lastName: true } },
              },
            },
          },
          take: 1,
        },
      },
      orderBy: [{ zone: { sortOrder: 'asc' } }, { roomNumber: 'asc' }],
    })

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const isTargetToday = targetDate.getTime() === today.getTime()

    // Compute effective status for the selected date
    const roomsWithStatus = rooms.map((room) => {
      const activeBooking = room.bookingRooms[0]
      let dateStatus: string

      if (activeBooking) {
        // Has a booking on this date
        if (activeBooking.booking.status === 'checked_in') dateStatus = 'occupied'
        else dateStatus = 'reserved'
      } else if (room.currentStatus === 'out_of_order' || room.currentStatus === 'out_of_service') {
        // OOO/OOS is always shown regardless of date
        dateStatus = room.currentStatus
      } else if (isTargetToday) {
        // Today: use actual physical status (dirty/cleaning matters for housekeeping)
        dateStatus = room.currentStatus
      } else {
        // Future/past date with no booking → available
        dateStatus = 'clean'
      }

      return {
        ...room,
        dateStatus,
        activeBooking: activeBooking ? {
          id: activeBooking.booking.id,
          bookingNumber: activeBooking.booking.bookingNumber,
          status: activeBooking.booking.status,
          checkOutDate: activeBooking.checkOutDate,
          guest: activeBooking.booking.guest,
        } : null,
        primaryImage: room.images[0]?.url ?? room.roomType.imageUrl ?? null,
      }
    })

    // Group by zone
    return zones.map((zone) => ({
      zone,
      rooms: roomsWithStatus.filter((r) => r.zoneId === zone.id),
    })).filter((g) => g.rooms.length > 0)
  }

  // Get room type availability for date range
  async getAvailability(propertyId: string, from: string, to: string) {
    const checkIn = new Date(from)
    const checkOut = new Date(to)

    const roomTypes = await this.prisma.roomType.findMany({
      where: { propertyId, active: true },
      orderBy: { name: 'asc' },
    })

    const result = await Promise.all(roomTypes.map(async (rt) => {
      const total = await this.prisma.room.count({ where: { propertyId, roomTypeId: rt.id, active: true } })

      const booked = await this.prisma.bookingRoom.count({
        where: {
          roomTypeId: rt.id,
          status: { notIn: ['cancelled'] },
          checkInDate: { lt: checkOut },
          checkOutDate: { gt: checkIn },
          booking: { propertyId, status: { notIn: ['cancelled', 'no_show', 'checked_out'] } },
        },
      })

      return {
        roomTypeId: rt.id,
        roomTypeName: rt.name,
        description: rt.description,
        imageUrl: rt.imageUrl,
        baseRate: rt.baseRate,
        maxOccupancy: rt.maxOccupancy,
        total,
        booked,
        available: Math.max(0, total - booked),
      }
    }))

    return result
  }

  // Get rooms for Grid: all rooms with their current booking in date range
  async getGrid(propertyId: string, from: string, to: string) {
    const [rooms, unassignedBookings] = await Promise.all([
      this.prisma.room.findMany({
        where: { propertyId, active: true },
        include: {
          roomType: { select: { id: true, name: true, imageUrl: true } },
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
      }),
      // Unassigned bookings (no specific room yet)
      this.prisma.bookingRoom.findMany({
        where: {
          roomId: null,
          checkInDate: { lte: new Date(to) },
          checkOutDate: { gte: new Date(from) },
          status: { notIn: ['cancelled'] },
          booking: { propertyId, status: { notIn: ['cancelled', 'no_show', 'checked_out'] } },
        },
        include: {
          roomType: { select: { id: true, name: true } },
          booking: {
            include: { guest: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      }),
    ])
    return { rooms, unassignedBookings }
  }
}
