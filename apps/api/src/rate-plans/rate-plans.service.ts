import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RatePlansService {
  constructor(private prisma: PrismaService) {}

  async findAll(propertyId: string) {
    return this.prisma.ratePlan.findMany({
      where: { propertyId, active: true },
      include: { roomType: true },
      orderBy: { name: 'asc' },
    })
  }

  async create(data: { propertyId: string; roomTypeId: string; name: string; basePrice: number; mealPlan?: string; cancellationPolicy?: string }) {
    return this.prisma.ratePlan.create({ data, include: { roomType: true } })
  }

  async update(id: string, data: Partial<{ name: string; basePrice: number; mealPlan: string; cancellationPolicy: string; active: boolean }>) {
    return this.prisma.ratePlan.update({ where: { id }, data, include: { roomType: true } })
  }

  async getDailyRates(propertyId: string, roomTypeId: string, from: string, to: string) {
    return this.prisma.dailyRate.findMany({
      where: { propertyId, roomTypeId, date: { gte: new Date(from), lte: new Date(to) } },
      include: { ratePlan: true },
      orderBy: { date: 'asc' },
    })
  }

  async setDailyRate(data: { propertyId: string; roomTypeId: string; ratePlanId: string; date: string; price: number; minStay?: number; stopSell?: boolean }) {
    return this.prisma.dailyRate.upsert({
      where: {
        propertyId_roomTypeId_ratePlanId_date: {
          propertyId: data.propertyId,
          roomTypeId: data.roomTypeId,
          ratePlanId: data.ratePlanId,
          date: new Date(data.date),
        },
      },
      create: { ...data, date: new Date(data.date) },
      update: { price: data.price, minStay: data.minStay, stopSell: data.stopSell },
    })
  }
}
