import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { RoomsService } from './rooms.service'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private service: RoomsService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('zoneId') zoneId?: string,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(user.propertyId!, { zoneId, roomTypeId, status })
  }

  @Get('grid')
  getGrid(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getGrid(user.propertyId!, from, to)
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id) }

  @Get(':id/status-logs')
  getStatusLogs(@Param('id') id: string) { return this.service.getStatusLogs(id) }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_MANAGE)
  create(@Body() body: { roomTypeId: string; zoneId?: string; roomNumber: string; roomName?: string; floorNo?: string; buildingName?: string; maxOccupancy: number }, @CurrentUser() user: JwtPayload) {
    return this.service.create({ ...body, propertyId: user.propertyId! })
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_MANAGE)
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.update(id, body as Parameters<RoomsService['update']>[1])
  }

  @Get(':id/images')
  getRoomImages(@Param('id') id: string) { return this.service.getRoomImages(id) }

  @Post(':id/images')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_MANAGE)
  addImage(@Param('id') id: string, @Body() body: { url: string; caption?: string; isPrimary?: boolean; sortOrder?: number }) {
    return this.service.addRoomImage(id, body)
  }

  @Delete('images/:imageId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_MANAGE)
  deleteImage(@Param('imageId') imageId: string) { return this.service.deleteRoomImage(imageId) }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_UPDATE_STATUS)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
    @CurrentUser() user: JwtPayload
  ) {
    return this.service.updateStatus(id, body.status, user.sub, body.reason)
  }
}
