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

  @Get('map')
  getRoomMap(
    @CurrentUser() user: JwtPayload,
    @Query('date') date?: string,
  ) {
    const d = date || new Date().toISOString().split('T')[0]
    return this.service.getRoomMap(user.propertyId!, d)
  }

  @Get('availability-calendar')
  getAvailabilityCalendar(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getAvailabilityCalendar(user.propertyId!, from, to)
  }

  @Get('availability')
  getAvailability(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.getAvailability(user.propertyId!, from, to)
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
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.findOne(id, user.propertyId!) }

  @Get(':id/status-logs')
  getStatusLogs(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.getStatusLogs(id, user.propertyId!) }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_MANAGE)
  create(@Body() body: { roomTypeId: string; zoneId?: string; roomNumber: string; roomName?: string; floorNo?: string; buildingName?: string; maxOccupancy: number }, @CurrentUser() user: JwtPayload) {
    return this.service.create({ ...body, propertyId: user.propertyId! })
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_MANAGE)
  update(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body as Parameters<RoomsService['update']>[1], user.propertyId!)
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_MANAGE)
  removeRoom(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.removeRoom(id, user.propertyId!) }

  @Get(':id/images')
  getRoomImages(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.getRoomImages(id, user.propertyId!) }

  @Post(':id/images')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_MANAGE)
  addImage(@Param('id') id: string, @Body() body: { url: string; caption?: string; isPrimary?: boolean; sortOrder?: number }, @CurrentUser() user: JwtPayload) {
    return this.service.addRoomImage(id, body, user.propertyId!)
  }

  @Delete('images/:imageId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_MANAGE)
  deleteImage(@Param('imageId') imageId: string, @CurrentUser() user: JwtPayload) { return this.service.deleteRoomImage(imageId, user.propertyId!) }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ROOM_UPDATE_STATUS)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
    @CurrentUser() user: JwtPayload
  ) {
    return this.service.updateStatus(id, body.status, user.sub, user.propertyId!, body.reason)
  }
}
