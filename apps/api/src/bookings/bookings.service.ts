import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  private generateBookingNumber(): string {
    const now = new Date()
    const y = now.getFullYear().toString().slice(-2)
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const rand = Math.floor(1000 + Math.random() * 9000)
    return `BK${y}${m}${d}${rand}`
  }

  async findAll(propertyId: string, filters?: {
    status?: string
    checkInDate?: string
    checkOutDate?: string
    guestName?: string
    page?: number
    limit?: number
  }) {
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { propertyId }
    if (filters?.status) where.status = filters.status
    if (filters?.checkInDate) where.checkInDate = { gte: new Date(filters.checkInDate) }
    if (filters?.checkOutDate) where.checkOutDate = { lte: new Date(filters.checkOutDate) }
    if (filters?.guestName) {
      where.guest = {
        OR: [
          { firstName: { contains: filters.guestName } },
          { lastName: { contains: filters.guestName } },
        ],
      }
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, phone: true } },
          bookingSource: true,
          bookingRooms: { include: { roomType: true, room: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ])

    return { bookings, total, page, limit }
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        guest: true,
        bookingSource: true,
        bookingRooms: { include: { roomType: true, room: { include: { zone: true } } } },
        folios: {
          include: {
            items: { where: { isVoided: false } },
            payments: { include: { refunds: true } },
            deposits: true,
          },
        },
        cancellation: true,
        statusLogs: { orderBy: { createdAt: 'desc' } },
        rateAdjustments: true,
      },
    })
    if (!booking) throw new NotFoundException('ไม่พบการจอง')
    return booking
  }

  async create(data: {
    propertyId: string
    guestId?: string
    newGuest?: {
      firstName: string; lastName: string; phone?: string; email?: string
      nationality?: string; idType?: string; idNumber?: string
    }
    roomTypeId: string
    checkInDate: string
    checkOutDate: string
    adults: number
    children: number
    rate: number
    bookingSourceId?: string
    notes?: string
    packageName?: string
    packageNote?: string
    depositAmount?: number
    depositMethod?: string
    createdBy: string
  }) {
    const checkIn = new Date(data.checkInDate)
    const checkOut = new Date(data.checkOutDate)
    if (checkOut <= checkIn) throw new BadRequestException('วันออกต้องหลังวันเข้าพัก')

    // Verify room type exists
    const roomType = await this.prisma.roomType.findUnique({ where: { id: data.roomTypeId } })
    if (!roomType) throw new NotFoundException('ไม่พบประเภทห้อง')

    return await this.prisma.$transaction(async (tx) => {
      // Check availability using count of overlapping confirmed bookings
      const overlapping = await tx.bookingRoom.count({
        where: {
          roomTypeId: data.roomTypeId,
          status: { notIn: ['cancelled'] },
          checkInDate: { lt: checkOut },
          checkOutDate: { gt: checkIn },
          booking: { propertyId: data.propertyId, status: { notIn: ['cancelled', 'no_show'] } },
        },
      })

      // Count total rooms of this type
      const totalRooms = await tx.room.count({
        where: { propertyId: data.propertyId, roomTypeId: data.roomTypeId, active: true },
      })

      if (overlapping >= totalRooms) {
        throw new ConflictException('ห้องประเภทนี้เต็มในช่วงวันที่เลือก')
      }

      // Create or use guest
      let guestId = data.guestId
      if (!guestId && data.newGuest) {
        const guest = await tx.guest.create({
          data: {
            propertyId: data.propertyId,
            ...data.newGuest,
          },
        })
        guestId = guest.id
      }
      if (!guestId) throw new BadRequestException('กรุณาระบุข้อมูลลูกค้า')

      const bookingNumber = this.generateBookingNumber()

      const booking = await tx.booking.create({
        data: {
          propertyId: data.propertyId,
          bookingNumber,
          guestId,
          bookingSourceId: data.bookingSourceId,
          status: 'confirmed',
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults: data.adults,
          children: data.children,
          packageName: data.packageName,
          packageNote: data.packageNote,
          notes: data.notes,
          createdBy: data.createdBy,
          bookingRooms: {
            create: {
              roomTypeId: data.roomTypeId,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              adults: data.adults,
              children: data.children,
              rate: data.rate,
              status: 'confirmed',
            },
          },
          folios: {
            create: {
              folioCode: 'A',
              folioType: 'master',
              guestId,
              status: 'open',
            },
          },
        },
        include: {
          guest: true,
          bookingRooms: { include: { roomType: true } },
          folios: true,
        },
      })

      // Add room charge to folio
      const folio = booking.folios[0]
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
      await tx.folioItem.create({
        data: {
          folioId: folio.id,
          itemType: 'room_charge',
          description: `ค่าห้อง ${roomType.name} (${nights} คืน)`,
          quantity: nights,
          unitPrice: data.rate,
          totalAmount: data.rate * nights,
          serviceDate: checkIn,
          createdBy: data.createdBy,
        },
      })

      // Record deposit if provided
      if (data.depositAmount && data.depositAmount > 0) {
        await tx.deposit.create({
          data: {
            bookingId: booking.id,
            folioId: folio.id,
            amount: data.depositAmount,
            depositType: 'booking_deposit',
            paymentMethod: data.depositMethod || 'cash',
            status: 'held',
            receivedBy: data.createdBy,
          },
        })
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          propertyId: data.propertyId,
          userId: data.createdBy,
          action: 'BOOKING_CREATE',
          entityType: 'booking',
          entityId: booking.id,
          newValueJson: { bookingNumber, guestId, checkIn: data.checkInDate, checkOut: data.checkOutDate },
        },
      })

      return booking
    })
  }

  async update(id: string, data: Partial<{
    checkInDate: string
    checkOutDate: string
    adults: number
    children: number
    bookingSourceId: string
    notes: string
    packageName: string
    packageNote: string
  }>, updatedBy: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } })
    if (!booking) throw new NotFoundException('ไม่พบการจอง')
    if (['checked_out', 'cancelled'].includes(booking.status)) {
      throw new BadRequestException('ไม่สามารถแก้ไขการจองที่สิ้นสุดแล้ว')
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        ...data,
        checkInDate: data.checkInDate ? new Date(data.checkInDate) : undefined,
        checkOutDate: data.checkOutDate ? new Date(data.checkOutDate) : undefined,
      },
      include: { guest: true, bookingRooms: { include: { roomType: true, room: true } } },
    })

    await this.prisma.auditLog.create({
      data: {
        propertyId: booking.propertyId,
        userId: updatedBy,
        action: 'BOOKING_UPDATE',
        entityType: 'booking',
        entityId: id,
      },
    })

    return updated
  }

  async assignRoom(bookingRoomId: string, roomId: string, assignedBy: string) {
    const br = await this.prisma.bookingRoom.findUnique({
      where: { id: bookingRoomId },
      include: { booking: true },
    })
    if (!br) throw new NotFoundException('ไม่พบข้อมูลการจองห้อง')

    const room = await this.prisma.room.findUnique({ where: { id: roomId } })
    if (!room) throw new NotFoundException('ไม่พบห้อง')
    if (room.currentStatus === 'out_of_order') throw new BadRequestException('ห้องนี้อยู่ระหว่างซ่อม')

    // Check room not double-booked
    const conflict = await this.prisma.bookingRoom.findFirst({
      where: {
        roomId,
        id: { not: bookingRoomId },
        status: { notIn: ['cancelled'] },
        checkInDate: { lt: br.checkOutDate },
        checkOutDate: { gt: br.checkInDate },
        booking: { status: { notIn: ['cancelled', 'no_show', 'checked_out'] } },
      },
    })
    if (conflict) throw new ConflictException('ห้องนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว')

    return this.prisma.bookingRoom.update({ where: { id: bookingRoomId }, data: { roomId } })
  }

  async moveRoom(bookingRoomId: string, newRoomId: string, movedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const br = await tx.bookingRoom.findUnique({
        where: { id: bookingRoomId },
        include: { booking: true },
      })
      if (!br) throw new NotFoundException('ไม่พบข้อมูลการจองห้อง')

      const room = await tx.room.findUnique({ where: { id: newRoomId } })
      if (!room) throw new NotFoundException('ไม่พบห้อง')
      if (room.currentStatus === 'out_of_order') throw new BadRequestException('ห้องนี้อยู่ระหว่างซ่อม')

      const conflict = await tx.bookingRoom.findFirst({
        where: {
          roomId: newRoomId,
          id: { not: bookingRoomId },
          status: { notIn: ['cancelled'] },
          checkInDate: { lt: br.checkOutDate },
          checkOutDate: { gt: br.checkInDate },
          booking: { status: { notIn: ['cancelled', 'no_show', 'checked_out'] } },
        },
      })
      if (conflict) throw new ConflictException('ห้องใหม่ถูกจองในช่วงเวลาดังกล่าวแล้ว')

      const updated = await tx.bookingRoom.update({ where: { id: bookingRoomId }, data: { roomId: newRoomId } })

      await tx.auditLog.create({
        data: {
          propertyId: br.booking.propertyId,
          userId: movedBy,
          action: 'BOOKING_MOVE_ROOM',
          entityType: 'booking_room',
          entityId: bookingRoomId,
          oldValueJson: { roomId: br.roomId },
          newValueJson: { roomId: newRoomId },
        },
      })

      return updated
    })
  }

  async checkIn(bookingId: string, checkedInBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { bookingRooms: { include: { room: true } } },
      })
      if (!booking) throw new NotFoundException('ไม่พบการจอง')
      if (booking.status !== 'confirmed' && booking.status !== 'pending') {
        throw new BadRequestException('สถานะการจองไม่ถูกต้องสำหรับการ Check-in')
      }

      // Validate all rooms are assigned and clean
      for (const br of booking.bookingRooms) {
        if (!br.roomId || !br.room) throw new BadRequestException(`กรุณา Assign ห้องก่อน Check-in`)
        if (br.room.currentStatus === 'out_of_order') {
          throw new BadRequestException(`ห้อง ${br.room.roomNumber} ไม่พร้อมใช้งาน`)
        }
      }

      // Update booking status
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'checked_in' } })

      // Update all rooms to occupied
      for (const br of booking.bookingRooms) {
        if (br.roomId) {
          await tx.room.update({ where: { id: br.roomId }, data: { currentStatus: 'occupied' } })
          await tx.roomStatusLog.create({
            data: { roomId: br.roomId, oldStatus: br.room!.currentStatus, newStatus: 'occupied', changedBy: checkedInBy, reason: 'Check-in' },
          })
        }
        await tx.bookingRoom.update({ where: { id: br.id }, data: { status: 'checked_in' } })
      }

      await tx.bookingStatusLog.create({
        data: { bookingId, oldStatus: booking.status, newStatus: 'checked_in', changedBy: checkedInBy },
      })

      await tx.auditLog.create({
        data: {
          propertyId: booking.propertyId,
          userId: checkedInBy,
          action: 'CHECK_IN',
          entityType: 'booking',
          entityId: bookingId,
        },
      })

      return tx.booking.findUnique({
        where: { id: bookingId },
        include: { guest: true, bookingRooms: { include: { room: true, roomType: true } }, folios: true },
      })
    })
  }

  async checkOut(bookingId: string, checkedOutBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          bookingRooms: { include: { room: true } },
          folios: { include: { items: { where: { isVoided: false } }, payments: true, deposits: true } },
        },
      })
      if (!booking) throw new NotFoundException('ไม่พบการจอง')
      if (booking.status !== 'checked_in') {
        throw new BadRequestException('สถานะการจองต้องเป็น Checked In ก่อน Check-out')
      }

      // Check balance
      const folio = booking.folios[0]
      if (folio) {
        const totalCharges = folio.items.reduce((sum, i) => sum + Number(i.totalAmount), 0)
        const totalPayments = folio.payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0)
        const totalDeposits = folio.deposits.filter(d => d.status === 'applied').reduce((sum, d) => sum + Number(d.amount), 0)
        const balance = totalCharges - totalPayments - totalDeposits
        if (balance > 0.01) {
          throw new BadRequestException(`ยังมียอดค้างชำระ ฿${balance.toFixed(2)} กรุณาชำระก่อน Check-out`)
        }

        // Close folio
        await tx.folio.update({ where: { id: folio.id }, data: { status: 'closed', closedAt: new Date() } })
      }

      // Update booking status
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'checked_out' } })

      // Update rooms to Dirty + create housekeeping tasks
      for (const br of booking.bookingRooms) {
        if (br.roomId && br.room) {
          await tx.room.update({ where: { id: br.roomId }, data: { currentStatus: 'dirty' } })
          await tx.roomStatusLog.create({
            data: { roomId: br.roomId, oldStatus: br.room.currentStatus, newStatus: 'dirty', changedBy: checkedOutBy, reason: 'Check-out' },
          })
          await tx.housekeepingTask.create({
            data: {
              propertyId: booking.propertyId,
              roomId: br.roomId,
              taskType: 'checkout_cleaning',
              status: 'pending',
            },
          })
        }
        await tx.bookingRoom.update({ where: { id: br.id }, data: { status: 'checked_out' } })
      }

      await tx.bookingStatusLog.create({
        data: { bookingId, oldStatus: 'checked_in', newStatus: 'checked_out', changedBy: checkedOutBy },
      })

      await tx.auditLog.create({
        data: {
          propertyId: booking.propertyId,
          userId: checkedOutBy,
          action: 'CHECK_OUT',
          entityType: 'booking',
          entityId: bookingId,
        },
      })

      return tx.booking.findUnique({
        where: { id: bookingId },
        include: { guest: true, bookingRooms: { include: { room: true, roomType: true } }, folios: true },
      })
    })
  }

  async cancel(bookingId: string, data: { reason: string; refundAmount?: number; cancellationFee?: number }, cancelledBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } })
      if (!booking) throw new NotFoundException('ไม่พบการจอง')
      if (['checked_in', 'checked_out', 'cancelled'].includes(booking.status)) {
        throw new BadRequestException('ไม่สามารถยกเลิกการจองในสถานะนี้')
      }

      await tx.booking.update({ where: { id: bookingId }, data: { status: 'cancelled' } })
      await tx.bookingRoom.updateMany({ where: { bookingId }, data: { status: 'cancelled' } })
      await tx.bookingCancellation.create({
        data: {
          bookingId,
          reason: data.reason,
          cancelledBy,
          refundAmount: data.refundAmount,
          cancellationFee: data.cancellationFee,
        },
      })
      await tx.bookingStatusLog.create({
        data: { bookingId, oldStatus: booking.status, newStatus: 'cancelled', changedBy: cancelledBy, remark: data.reason },
      })
      await tx.auditLog.create({
        data: {
          propertyId: booking.propertyId,
          userId: cancelledBy,
          action: 'BOOKING_CANCEL',
          entityType: 'booking',
          entityId: bookingId,
          newValueJson: { reason: data.reason },
        },
      })

      return { success: true }
    })
  }

  async adjustRate(bookingId: string, data: { bookingRoomId: string; newRate: number; reason: string; adjustmentType?: string }, adjustedBy: string) {
    const bookingRoom = await this.prisma.bookingRoom.findUnique({ where: { id: data.bookingRoomId } })
    if (!bookingRoom) throw new NotFoundException('ไม่พบข้อมูลห้องในการจอง')

    const oldPrice = Number(bookingRoom.rate)

    return this.prisma.$transaction(async (tx) => {
      await tx.bookingRoom.update({ where: { id: data.bookingRoomId }, data: { rate: data.newRate } })

      await tx.rateAdjustment.create({
        data: {
          bookingId,
          oldPrice,
          newPrice: data.newRate,
          adjustmentType: data.adjustmentType || 'manual_override',
          reason: data.reason,
          createdBy: adjustedBy,
        },
      })

      // Update room charge folio item if exists
      const folio = await tx.folio.findFirst({ where: { bookingId, status: 'open' } })
      if (folio) {
        const booking = await tx.booking.findUnique({ where: { id: bookingId } })
        if (booking) {
          const nights = Math.ceil((booking.checkOutDate.getTime() - booking.checkInDate.getTime()) / (1000 * 60 * 60 * 24))
          const roomChargeItem = await tx.folioItem.findFirst({
            where: { folioId: folio.id, itemType: 'room_charge', isVoided: false },
          })
          if (roomChargeItem) {
            await tx.folioItem.update({
              where: { id: roomChargeItem.id },
              data: { unitPrice: data.newRate, totalAmount: data.newRate * nights },
            })
          }
        }
      }

      await tx.auditLog.create({
        data: {
          propertyId: bookingRoom.id,
          userId: adjustedBy,
          action: 'PRICE_OVERRIDE',
          entityType: 'booking_room',
          entityId: data.bookingRoomId,
          oldValueJson: { rate: oldPrice },
          newValueJson: { rate: data.newRate, reason: data.reason },
        },
      })

      return { success: true, oldPrice, newPrice: data.newRate }
    })
  }

  async markNoShow(bookingId: string, data: { noShowFee?: number; remark?: string }, markedBy: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new NotFoundException('ไม่พบการจอง')
    if (booking.status !== 'confirmed') throw new BadRequestException('สถานะต้องเป็น Confirmed')

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'no_show',
        noShowMarkedBy: markedBy,
        noShowMarkedAt: new Date(),
        noShowFee: data.noShowFee,
      },
    })

    return { success: true }
  }

  async getBookingSources(propertyId: string) {
    return this.prisma.bookingSource.findMany({ where: { propertyId }, orderBy: { name: 'asc' } })
  }

  async createBookingSource(data: { propertyId: string; name: string; sourceType?: string }) {
    return this.prisma.bookingSource.create({ data: { ...data, sourceType: data.sourceType || 'direct' } })
  }

  async updateBookingSource(id: string, data: Partial<{ name: string; sourceType: string; active: boolean }>) {
    return this.prisma.bookingSource.update({ where: { id }, data })
  }
}
