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
    @Query('search') search?: string,
    @Query('nationality') nationality?: string,
    @Query('blacklist') blacklist?: string,
    @Query('returning') returning?: string,
  ) {
    return this.service.findAll(user.propertyId!, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search: search || undefined,
      nationality: nationality || undefined,
      blacklist: blacklist === 'true',
      returning: returning === 'true',
    })
  }

  @Get('search')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_VIEW)
  search(@CurrentUser() user: JwtPayload, @Query('q') q: string) {
    return this.service.search(user.propertyId!, q || '')
  }

  @Get('nationalities')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_VIEW)
  getNationalities(@CurrentUser() user: JwtPayload) {
    return this.service.getNationalities(user.propertyId!)
  }

  @Get('stats')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_VIEW)
  getStats(@CurrentUser() user: JwtPayload) {
    return this.service.getStats(user.propertyId!)
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
