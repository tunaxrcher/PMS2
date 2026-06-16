import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ZonesService {
  constructor(private prisma: PrismaService) {}

  async findAll(propertyId: string) {
    const zones = await this.prisma.zone.findMany({
      where: { propertyId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return this.buildTree(zones)
  }

  async findFlat(propertyId: string) {
    return this.prisma.zone.findMany({
      where: { propertyId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  async create(data: { propertyId: string; name: string; zoneType?: string; parentZoneId?: string; sortOrder?: number }) {
    return this.prisma.zone.create({ data })
  }

  async update(id: string, data: Partial<{ name: string; zoneType: string; parentZoneId: string; sortOrder: number; active: boolean }>) {
    const zone = await this.prisma.zone.findUnique({ where: { id } })
    if (!zone) throw new NotFoundException('ไม่พบโซน')
    return this.prisma.zone.update({ where: { id }, data })
  }

  async remove(id: string) {
    await this.prisma.zone.update({ where: { id }, data: { active: false } })
    return { success: true }
  }

  private buildTree(zones: { id: string; parentZoneId: string | null; name: string; zoneType: string; propertyId: string; sortOrder: number; active: boolean; createdAt: Date; updatedAt: Date }[]) {
    const map = new Map<string, typeof zones[0] & { children: unknown[] }>()
    const roots: (typeof zones[0] & { children: unknown[] })[] = []

    zones.forEach((z) => map.set(z.id, { ...z, children: [] }))
    zones.forEach((z) => {
      if (z.parentZoneId && map.has(z.parentZoneId)) {
        map.get(z.parentZoneId)!.children.push(map.get(z.id)!)
      } else {
        roots.push(map.get(z.id)!)
      }
    })
    return roots
  }
}
