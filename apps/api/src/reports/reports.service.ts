import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDailyRevenue(propertyId: string, date: string) {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    const payments = await this.prisma.payment.findMany({
      where: {
        paidAt: { gte: start, lte: end },
        status: 'paid',
        folio: { booking: { propertyId } },
      },
      include: { folio: { include: { booking: true } } },
    })

    const refunds = await this.prisma.refund.findMany({
      where: {
        refundedAt: { gte: start, lte: end },
        payment: { folio: { booking: { propertyId } } },
      },
    })

    const byMethod: Record<string, number> = {}
    let totalGross = 0
    payments.forEach((p) => {
      const method = p.paymentMethod
      byMethod[method] = (byMethod[method] || 0) + Number(p.amount)
      totalGross += Number(p.amount)
    })

    const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount), 0)
    const totalNet = totalGross - totalRefunds

    return { date, byMethod, totalGross, totalRefunds, totalNet, transactionCount: payments.length }
  }

  async getDailyRevenueRange(propertyId: string, from: string, to: string) {
    const results = []
    const current = new Date(from)
    const end = new Date(to)
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]
      results.push(await this.getDailyRevenue(propertyId, dateStr))
      current.setDate(current.getDate() + 1)
    }
    return results
  }

  async getOccupancy(propertyId: string, date: string) {
    const checkDate = new Date(date)

    const totalRooms = await this.prisma.room.count({ where: { propertyId, active: true } })
    const outOfOrder = await this.prisma.room.count({ where: { propertyId, currentStatus: 'out_of_order', active: true } })

    // Occupied = guests currently checked in covering this date
    const occupied = await this.prisma.bookingRoom.count({
      where: {
        booking: { propertyId, status: 'checked_in' },
        checkInDate: { lte: checkDate },
        checkOutDate: { gt: checkDate },
        status: 'checked_in',
      },
    })

    // Reserved = confirmed/pending bookings covering this date (not yet checked in)
    // These rooms are NOT available — consistent with the room-map "reserved" status.
    const reserved = await this.prisma.bookingRoom.count({
      where: {
        booking: { propertyId, status: { in: ['confirmed', 'pending'] } },
        status: { notIn: ['cancelled', 'no_show'] },
        checkInDate: { lte: checkDate },
        checkOutDate: { gt: checkDate },
      },
    })

    // Available = total minus OOO, occupied, and reserved (booked but not checked in)
    const available = Math.max(0, totalRooms - outOfOrder - occupied - reserved)
    // Occupancy = sold rooms (checked-in + reserved) / total — consistent with the 7-day forecast
    const sold = occupied + reserved
    const occupancyPct = totalRooms > 0 ? Math.round((sold / totalRooms) * 100) : 0

    return { date, totalRooms, occupied, reserved, confirmed: reserved, outOfOrder, available, occupancyPct }
  }

  async getBookingSources(propertyId: string, from: string, to: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        propertyId,
        status: { notIn: ['cancelled', 'no_show'] },
        checkInDate: { gte: new Date(from), lte: new Date(to) },
      },
      include: {
        bookingSource: true,
        folios: { include: { payments: { where: { status: 'paid' } } } },
      },
    })

    const sourceMap: Record<string, { count: number; revenue: number; name: string }> = {}

    bookings.forEach((b) => {
      const sourceName = b.bookingSource?.name || 'ไม่ระบุ'
      const sourceId = b.bookingSourceId || 'unknown'
      if (!sourceMap[sourceId]) sourceMap[sourceId] = { count: 0, revenue: 0, name: sourceName }
      sourceMap[sourceId].count++
      b.folios.forEach((f) => {
        f.payments.forEach((p) => { sourceMap[sourceId].revenue += Number(p.amount) })
      })
    })

    return Object.entries(sourceMap).map(([id, data]) => ({ sourceId: id, ...data }))
  }

  async getHousekeeping(propertyId: string, date: string) {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    const tasks = await this.prisma.housekeepingTask.findMany({
      where: { propertyId, createdAt: { gte: start, lte: end } },
      include: { room: { include: { zone: true } } },
    })

    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
      tasks,
    }
  }

  async getDashboard(propertyId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)
    // Build date string from LOCAL components — toISOString() would shift to
    // the previous day in UTC+ timezones (local midnight = 17:00 UTC prev day).
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const todayStr = `${y}-${m}-${d}`

    const [occupancy, revenue, arrivals, departures, pendingHousekeeping] = await Promise.all([
      this.getOccupancy(propertyId, todayStr),
      this.getDailyRevenue(propertyId, todayStr),
      this.prisma.booking.count({ where: { propertyId, status: 'confirmed', checkInDate: { gte: today, lte: todayEnd } } }),
      this.prisma.booking.count({ where: { propertyId, status: 'checked_in', checkOutDate: { gte: today, lte: todayEnd } } }),
      this.prisma.housekeepingTask.count({ where: { propertyId, status: { in: ['pending', 'in_progress'] } } }),
    ])

    return { occupancy, revenue, arrivals, departures, pendingHousekeeping }
  }
}
