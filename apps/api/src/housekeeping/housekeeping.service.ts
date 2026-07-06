import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class HousekeepingService {
  constructor(private prisma: PrismaService) {}

  async findTasks(propertyId: string, filters?: { status?: string; roomId?: string }) {
    // Today's calendar window (UTC midnight — @db.Date is stored at UTC midnight).
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const todayStart = new Date(todayStr)
    const tomorrow = new Date(todayStart)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { checkInTime: true },
    })

    const tasks = await this.prisma.housekeepingTask.findMany({
      where: {
        propertyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.roomId && { roomId: filters.roomId }),
      },
      include: {
        room: {
          include: {
            roomType: { select: { id: true, name: true, imageUrl: true } },
            zone: { select: { id: true, name: true, imageUrl: true } },
            // An arrival expected today (not yet checked in) makes a checkout
            // cleaning URGENT — the room must be ready before the new guest arrives.
            bookingRooms: {
              where: {
                checkInDate: { gte: todayStart, lt: tomorrow },
                status: { notIn: ['checked_in', 'checked_out', 'cancelled', 'no_show'] },
                booking: { status: { notIn: ['checked_in', 'checked_out', 'cancelled', 'no_show'] } },
              },
              include: { booking: { include: { guest: { select: { firstName: true, lastName: true } } } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return tasks.map((task) => {
      const arrival = task.room.bookingRooms[0]
      const { bookingRooms, ...room } = task.room
      return {
        ...task,
        room: {
          ...room,
          arrivalToday: arrival
            ? {
                guestName: `${arrival.booking.guest.firstName} ${arrival.booking.guest.lastName}`.trim(),
                readyBy: property?.checkInTime ?? '14:00',
              }
            : null,
        },
      }
    })
  }

  private async assertTaskProperty(taskId: string, propertyId: string) {
    const task = await this.prisma.housekeepingTask.findUnique({ where: { id: taskId } })
    if (!task || task.propertyId !== propertyId) throw new NotFoundException('ไม่พบงาน')
    return task
  }

  async startTask(taskId: string, startedBy: string, propertyId: string) {
    const task = await this.assertTaskProperty(taskId, propertyId)
    if (task.status !== 'pending') throw new BadRequestException('งานนี้ไม่อยู่ในสถานะรอดำเนินการ')

    await this.prisma.$transaction([
      this.prisma.housekeepingTask.update({
        where: { id: taskId },
        data: { status: 'in_progress', startedAt: new Date(), assignedTo: startedBy },
      }),
      this.prisma.room.update({
        where: { id: task.roomId },
        data: { currentStatus: 'cleaning' },
      }),
    ])

    return this.prisma.housekeepingTask.findUnique({
      where: { id: taskId },
      include: { room: { include: { roomType: true, zone: true } } },
    })
  }

  async completeTask(taskId: string, completedBy: string, propertyId: string, remark?: string) {
    const task = await this.assertTaskProperty(taskId, propertyId)
    if (task.status !== 'in_progress') throw new BadRequestException('กรุณาเริ่มงานก่อน')

    // If the guest is still in-house (a stayover clean), the room must go back to
    // 'occupied', not 'clean' — otherwise the room status desyncs from the active
    // booking (room shows vacant while the guest is still staying).
    const hasGuest = await this.prisma.bookingRoom.findFirst({
      where: { roomId: task.roomId, status: 'checked_in', booking: { status: 'checked_in' } },
      select: { id: true },
    })
    const resultingStatus = hasGuest ? 'occupied' : 'clean'

    await this.prisma.$transaction([
      this.prisma.housekeepingTask.update({
        where: { id: taskId },
        data: { status: 'done', completedAt: new Date(), remark },
      }),
      this.prisma.room.update({
        where: { id: task.roomId },
        data: { currentStatus: resultingStatus },
      }),
      this.prisma.roomStatusLog.create({
        data: {
          roomId: task.roomId,
          oldStatus: 'cleaning',
          newStatus: resultingStatus,
          changedBy: completedBy,
          reason: hasGuest ? 'ทำความสะอาดระหว่างพักเสร็จ' : 'ทำความสะอาดเสร็จ',
        },
      }),
    ])

    return this.prisma.housekeepingTask.findUnique({
      where: { id: taskId },
      include: { room: { include: { roomType: true, zone: true } } },
    })
  }

  async cancelTask(taskId: string, propertyId: string) {
    const task = await this.assertTaskProperty(taskId, propertyId)
    // If the task was in progress the room is currently 'cleaning'; roll it back.
    // A room with a still-in-house guest returns to 'occupied', otherwise 'dirty'
    // so another cleaning task can be assigned.
    let resetStatus: string | null = null
    if (task.status === 'in_progress') {
      const hasGuest = await this.prisma.bookingRoom.findFirst({
        where: { roomId: task.roomId, status: 'checked_in', booking: { status: 'checked_in' } },
        select: { id: true },
      })
      resetStatus = hasGuest ? 'occupied' : 'dirty'
    }
    return this.prisma.$transaction([
      this.prisma.housekeepingTask.update({ where: { id: taskId }, data: { status: 'cancelled' } }),
      ...(resetStatus ? [
        this.prisma.room.update({ where: { id: task.roomId }, data: { currentStatus: resetStatus } })
      ] : []),
    ])
  }

  async createTask(data: { propertyId: string; roomId: string; taskType: string; assignedTo?: string; remark?: string }) {
    const room = await this.prisma.room.findUnique({ where: { id: data.roomId }, select: { propertyId: true } })
    if (!room || room.propertyId !== data.propertyId) throw new NotFoundException('ไม่พบห้อง')
    return this.prisma.housekeepingTask.create({
      data,
      include: { room: { include: { roomType: true, zone: true } } },
    })
  }
}
