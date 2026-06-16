import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { GuestsService } from './guests.service'
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
  findOne(@Param('id') id: string, @Query('sensitive') sensitive?: string, @CurrentUser() user?: JwtPayload) {
    return this.service.findOne(id, sensitive === 'true', user?.propertyId || undefined)
  }

  @Get(':id/bookings')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_VIEW)
  getBookingHistory(@Param('id') id: string) {
    return this.service.getBookingHistory(id)
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_CREATE)
  create(@Body() body: Parameters<GuestsService['create']>[0], @CurrentUser() user: JwtPayload) {
    return this.service.create({ ...body, propertyId: user.propertyId! })
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.GUEST_UPDATE)
  update(@Param('id') id: string, @Body() body: Parameters<GuestsService['update']>[1]) {
    return this.service.update(id, body)
  }
}
