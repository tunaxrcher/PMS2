import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async findAll(propertyId: string, filters?: { status?: string; roomId?: string }) {
    return this.prisma.maintenanceTicket.findMany({
      where: {
        propertyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.roomId && { roomId: filters.roomId }),
      },
      include: { room: { include: { roomType: true, zone: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id },
      include: { room: { include: { roomType: true, zone: true } } },
    })
    if (!ticket) throw new NotFoundException('ไม่พบใบแจ้งซ่อม')
    return ticket
  }

  async create(data: {
    propertyId: string
    roomId?: string
    issueTitle: string
    issueDetail?: string
    priority?: string
    reportedBy: string
  }) {
    const ticket = await this.prisma.maintenanceTicket.create({ data, include: { room: true } })

    // Set room to out_of_order if it's a room issue
    if (data.roomId && ['high', 'urgent'].includes(data.priority || '')) {
      await this.prisma.room.update({
        where: { id: data.roomId },
        data: { currentStatus: 'out_of_order' },
      })
    }

    return ticket
  }

  async update(id: string, data: Partial<{ issueTitle: string; issueDetail: string; priority: string; status: string }>) {
    const ticket = await this.prisma.maintenanceTicket.findUnique({ where: { id } })
    if (!ticket) throw new NotFoundException('ไม่พบใบแจ้งซ่อม')
    return this.prisma.maintenanceTicket.update({ where: { id }, data })
  }

  async resolve(id: string, resolvedBy: string) {
    const ticket = await this.prisma.maintenanceTicket.findUnique({ where: { id } })
    if (!ticket) throw new NotFoundException('ไม่พบใบแจ้งซ่อม')

    const resolved = await this.prisma.maintenanceTicket.update({
      where: { id },
      data: { status: 'resolved', resolvedBy, resolvedAt: new Date() },
    })

    // Clear OOO if room was set by this ticket and no other open tickets
    if (ticket.roomId) {
      const openTickets = await this.prisma.maintenanceTicket.count({
        where: { roomId: ticket.roomId, status: { in: ['open', 'in_progress'] } },
      })
      if (openTickets === 0) {
        await this.prisma.room.update({ where: { id: ticket.roomId }, data: { currentStatus: 'clean' } })
      }
    }

    return resolved
  }
}
