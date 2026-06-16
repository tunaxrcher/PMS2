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
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Number(page) || 1
    const l = Number(limit) || 30
    const where: Record<string, unknown> = { propertyId: user.propertyId }
    if (entityType) where.entityType = entityType
    if (userId) where.userId = userId
    if (from || to) {
      where.createdAt = {}
      if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from)
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to)
    }
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p - 1) * l, take: l }),
      this.prisma.auditLog.count({ where }),
    ])
    return { logs, total, page: p, limit: l }
  }
}
