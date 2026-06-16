import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class HousekeepingService {
  constructor(private prisma: PrismaService) {}

  async findTasks(propertyId: string, filters?: { status?: string; roomId?: string }) {
    return this.prisma.housekeepingTask.findMany({
      where: {
        propertyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.roomId && { roomId: filters.roomId }),
      },
      include: {
        room: { include: { roomType: { select: { id: true, name: true, imageUrl: true } }, zone: { select: { id: true, name: true, imageUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async startTask(taskId: string, startedBy: string) {
    const task = await this.prisma.housekeepingTask.findUnique({ where: { id: taskId } })
    if (!task) throw new NotFoundException('ไม่พบงาน')
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

  async completeTask(taskId: string, completedBy: string, remark?: string) {
    const task = await this.prisma.housekeepingTask.findUnique({ where: { id: taskId } })
    if (!task) throw new NotFoundException('ไม่พบงาน')
    if (task.status !== 'in_progress') throw new BadRequestException('กรุณาเริ่มงานก่อน')

    await this.prisma.$transaction([
      this.prisma.housekeepingTask.update({
        where: { id: taskId },
        data: { status: 'done', completedAt: new Date(), remark },
      }),
      this.prisma.room.update({
        where: { id: task.roomId },
        data: { currentStatus: 'clean' },
      }),
      this.prisma.roomStatusLog.create({
        data: {
          roomId: task.roomId,
          oldStatus: 'cleaning',
          newStatus: 'clean',
          changedBy: completedBy,
          reason: 'ทำความสะอาดเสร็จ',
        },
      }),
    ])

    return this.prisma.housekeepingTask.findUnique({
      where: { id: taskId },
      include: { room: { include: { roomType: true, zone: true } } },
    })
  }

  async cancelTask(taskId: string) {
    const task = await this.prisma.housekeepingTask.findUnique({ where: { id: taskId } })
    if (!task) throw new NotFoundException('ไม่พบงาน')
    return this.prisma.housekeepingTask.update({ where: { id: taskId }, data: { status: 'cancelled' } })
  }

  async createTask(data: { propertyId: string; roomId: string; taskType: string; assignedTo?: string; remark?: string }) {
    return this.prisma.housekeepingTask.create({
      data,
      include: { room: { include: { roomType: true, zone: true } } },
    })
  }
}
