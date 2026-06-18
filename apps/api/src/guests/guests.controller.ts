import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { GuestsService } from './guests.service'
import { CreateGuestDto, UpdateGuestDto } from './dto/guest.dto'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard)
@Controller('guests')
export class GuestsController {
  constructor(private service: GuestsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.GUEST_VIEW)
  @UseGuards(PermissionsGuard)
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.propertyId!, Number(page) || 1, Number(limit) || 20)
  }

  @Get('search')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_VIEW)
  search(@CurrentUser() user: JwtPayload, @Query('q') q: string) {
    return this.service.search(user.propertyId!, q || '')
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_VIEW)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Query('sensitive') sensitive?: string) {
    // Only expose PII if caller actually holds the sensitive-view permission
    const canViewSensitive = sensitive === 'true' && user.permissions.includes(PERMISSIONS.GUEST_VIEW_SENSITIVE)
    return this.service.findOne(id, canViewSensitive, user.propertyId!)
  }

  @Get(':id/bookings')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_VIEW)
  getBookingHistory(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.getBookingHistory(id, user.propertyId!)
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_CREATE)
  create(@Body() body: CreateGuestDto, @CurrentUser() user: JwtPayload) {
    return this.service.create({ ...body, propertyId: user.propertyId! })
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_UPDATE)
  update(@Param('id') id: string, @Body() body: UpdateGuestDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body, user.propertyId!)
  }
}
