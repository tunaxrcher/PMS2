import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { HousekeepingService } from './housekeeping.service'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('housekeeping')
export class HousekeepingController {
  constructor(private service: HousekeepingService) {}

  @Get('tasks')
  @RequirePermissions(PERMISSIONS.HOUSEKEEPING_VIEW)
  findTasks(@CurrentUser() user: JwtPayload, @Query('status') status?: string, @Query('roomId') roomId?: string) {
    return this.service.findTasks(user.propertyId!, { status, roomId })
  }

  @Post('tasks')
  @RequirePermissions(PERMISSIONS.HOUSEKEEPING_UPDATE_TASK)
  createTask(@Body() body: { roomId: string; taskType: string; assignedTo?: string; remark?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.createTask({ ...body, propertyId: user.propertyId! })
  }

  @Post('tasks/:id/start')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.HOUSEKEEPING_UPDATE_TASK)
  start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.startTask(id, user.sub, user.propertyId!)
  }

  @Post('tasks/:id/complete')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.HOUSEKEEPING_UPDATE_TASK)
  complete(@Param('id') id: string, @Body() body: { remark?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.completeTask(id, user.sub, user.propertyId!, body.remark)
  }

  @Post('tasks/:id/cancel')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.HOUSEKEEPING_UPDATE_TASK)
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.cancelTask(id, user.propertyId!)
  }
}
