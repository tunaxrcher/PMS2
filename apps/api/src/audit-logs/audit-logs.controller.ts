import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_LOG_VIEW)
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Number(page) || 1
    const l = Number(limit) || 50

    // Include logs with matching property OR null property (system-wide actions)
    const baseConditions: Record<string, unknown>[] = [
      { propertyId: user.propertyId },
      { propertyId: null },
    ]

    const andConditions: Record<string, unknown>[] = []

    if (entityType) andConditions.push({ entityType })
    if (action) andConditions.push({ action: { contains: action } })
    if (userId) andConditions.push({ userId })

    if (from || to) {
      const createdAtFilter: Record<string, unknown> = {}
      if (from) createdAtFilter.gte = new Date(from + 'T00:00:00.000Z')
      if (to) {
        // End of day in UTC to include all records for that date
        createdAtFilter.lte = new Date(to + 'T23:59:59.999Z')
      }
      andConditions.push({ createdAt: createdAtFilter })
    }

    const where = andConditions.length > 0
      ? { AND: [{ OR: baseConditions }, ...andConditions] }
      : { OR: baseConditions }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
      this.prisma.auditLog.count({ where }),
    ])

    // Enrich with user names
    const userIds = [...new Set(logs.filter(l => l.userId).map(l => l.userId as string))]
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, phone: true },
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    const enriched = logs.map(log => ({
      ...log,
      user: log.userId ? userMap[log.userId] : null,
    }))

    return { logs: enriched, total, page: p, limit: l }
  }

  @Get('actions')
  @RequirePermissions(PERMISSIONS.AUDIT_LOG_VIEW)
  async getActions(@CurrentUser() user: JwtPayload) {
    const actions = await this.prisma.auditLog.findMany({
      where: { OR: [{ propertyId: user.propertyId }, { propertyId: null }] },
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    })
    return actions.map(a => a.action)
  }
}
