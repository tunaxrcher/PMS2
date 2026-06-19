import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { BookingsService } from './bookings.service'
import { CreateBookingDto } from './dto/create-booking.dto'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private service: BookingsService) {}

  @Get('sources')
  getSources(@CurrentUser() user: JwtPayload) {
    return this.service.getBookingSources(user.propertyId!)
  }

  @Post('sources')
  @RequirePermissions(PERMISSIONS.PROPERTY_MANAGE)
  createSource(@Body() body: { name: string; sourceType?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.createBookingSource({ ...body, propertyId: user.propertyId! })
  }

  @Patch('sources/:id')
  @RequirePermissions(PERMISSIONS.PROPERTY_MANAGE)
  updateSource(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.service.updateBookingSource(id, body, user.propertyId!)
  }

  @Get()
  @RequirePermissions(PERMISSIONS.BOOKING_VIEW)
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('checkInDate') checkInDate?: string,
    @Query('checkOutDate') checkOutDate?: string,
    @Query('checkInFrom') checkInFrom?: string,
    @Query('checkInTo') checkInTo?: string,
    @Query('bookingSourceId') bookingSourceId?: string,
    @Query('guestName') guestName?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.propertyId!, { status, checkInDate, checkOutDate, checkInFrom, checkInTo, bookingSourceId, guestName, page: Number(page), limit: Number(limit) })
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BOOKING_VIEW)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.findOne(id, user.propertyId!) }

  @Post()
  @RequirePermissions(PERMISSIONS.BOOKING_CREATE)
  create(@Body() body: CreateBookingDto, @CurrentUser() user: JwtPayload) {
    return this.service.create({ ...body, propertyId: user.propertyId!, createdBy: user.sub })
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  update(@Param('id') id: string, @Body() body: Parameters<BookingsService['update']>[1], @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body, user.sub, user.propertyId!)
  }

  @Post(':id/assign-room')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.BOOKING_ASSIGN_ROOM)
  assignRoom(@Param('id') _id: string, @Body() body: { bookingRoomId: string; roomId: string }, @CurrentUser() user: JwtPayload) {
    return this.service.assignRoom(body.bookingRoomId, body.roomId, user.sub, user.propertyId!)
  }

  @Post(':id/move-room')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.BOOKING_MOVE_ROOM)
  moveRoom(@Param('id') _id: string, @Body() body: { bookingRoomId: string; newRoomId: string }, @CurrentUser() user: JwtPayload) {
    return this.service.moveRoom(body.bookingRoomId, body.newRoomId, user.sub, user.propertyId!)
  }

  @Post(':id/check-in')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.BOOKING_CHECK_IN)
  checkIn(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.checkIn(id, user.sub, user.propertyId!)
  }

  @Post(':id/check-out')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.BOOKING_CHECK_OUT)
  checkOut(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.checkOut(id, user.sub, user.propertyId!)
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  confirm(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.confirmBooking(id, user.sub, user.propertyId!)
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.BOOKING_CANCEL)
  cancel(
    @Param('id') id: string,
    @Body() body: { reason: string; refundAmount?: number; cancellationFee?: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.cancel(id, body, user.sub, user.propertyId!)
  }

  @Post(':id/adjust-rate')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.PRICE_OVERRIDE)
  adjustRate(
    @Param('id') id: string,
    @Body() body: { bookingRoomId: string; newRate: number; reason: string; adjustmentType?: string },
    @CurrentUser() user: JwtPayload
  ) {
    return this.service.adjustRate(id, body, user.sub, user.propertyId!)
  }

  @Post(':id/no-show')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.BOOKING_CANCEL)
  markNoShow(
    @Param('id') id: string,
    @Body() body: { noShowFee?: number; remark?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.markNoShow(id, body, user.sub, user.propertyId!)
  }
}
