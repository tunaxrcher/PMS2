import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { RatePlansService } from './rate-plans.service'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard)
@Controller('rate-plans')
export class RatePlansController {
  constructor(private service: RatePlansService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) { return this.service.findAll(user.propertyId!) }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RATE_PLAN_MANAGE)
  create(@Body() body: Parameters<RatePlansService['create']>[0], @CurrentUser() user: JwtPayload) {
    return this.service.create({ ...body, propertyId: user.propertyId! })
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RATE_PLAN_MANAGE)
  update(@Param('id') id: string, @Body() body: Parameters<RatePlansService['update']>[1], @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body, user.propertyId!)
  }

  @Get('daily-rates')
  getDailyRates(@CurrentUser() user: JwtPayload, @Query('roomTypeId') roomTypeId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.service.getDailyRates(user.propertyId!, roomTypeId, from, to)
  }

  @Post('daily-rates')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.RATE_PLAN_MANAGE)
  setDailyRate(@Body() body: Parameters<RatePlansService['setDailyRate']>[0], @CurrentUser() user: JwtPayload) {
    return this.service.setDailyRate({ ...body, propertyId: user.propertyId! })
  }
}
