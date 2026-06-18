import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { MaintenanceService } from './maintenance.service'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private service: MaintenanceService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_VIEW)
  findAll(@CurrentUser() user: JwtPayload, @Query('status') status?: string, @Query('roomId') roomId?: string) {
    return this.service.findAll(user.propertyId!, { status, roomId })
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_VIEW)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.findOne(id, user.propertyId!) }

  @Post()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_CREATE)
  create(@Body() body: { roomId?: string; issueTitle: string; issueDetail?: string; priority?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.create({ ...body, propertyId: user.propertyId!, reportedBy: user.sub })
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_CREATE)
  update(@Param('id') id: string, @Body() body: { status?: string; priority?: string; issueDetail?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body, user.propertyId!)
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.MAINTENANCE_RESOLVE)
  resolve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.resolve(id, user.sub, user.propertyId!)
  }
}
