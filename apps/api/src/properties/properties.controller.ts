import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { PropertiesService } from './properties.service'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private service: PropertiesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) { return this.service.findAll(user.propertyId!) }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.findOne(id, user.propertyId!) }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.PROPERTY_MANAGE)
  update(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, body as Parameters<PropertiesService['update']>[1], user.propertyId!)
  }
}
