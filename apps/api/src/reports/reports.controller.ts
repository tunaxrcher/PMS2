import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { ReportsService } from './reports.service'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.service.getDashboard(user.propertyId!)
  }

  @Get('daily-revenue')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  getDailyRevenue(@CurrentUser() user: JwtPayload, @Query('date') date?: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (from && to) return this.service.getDailyRevenueRange(user.propertyId!, from, to)
    const d = date || new Date().toISOString().split('T')[0]
    return this.service.getDailyRevenue(user.propertyId!, d)
  }

  @Get('occupancy')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  getOccupancy(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    const d = date || new Date().toISOString().split('T')[0]
    return this.service.getOccupancy(user.propertyId!, d)
  }

  @Get('booking-sources')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  getBookingSources(@CurrentUser() user: JwtPayload, @Query('from') from: string, @Query('to') to: string) {
    const today = new Date().toISOString().split('T')[0]
    return this.service.getBookingSources(user.propertyId!, from || today, to || today)
  }

  @Get('housekeeping')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  getHousekeeping(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    const d = date || new Date().toISOString().split('T')[0]
    return this.service.getHousekeeping(user.propertyId!, d)
  }
}
