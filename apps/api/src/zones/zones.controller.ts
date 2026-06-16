import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { ZonesService } from './zones.service'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard)
@Controller('zones')
export class ZonesController {
  constructor(private service: ZonesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) { return this.service.findAll(user.propertyId!) }

  @Get('flat')
  findFlat(@CurrentUser() user: JwtPayload) { return this.service.findFlat(user.propertyId!) }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.PROPERTY_MANAGE)
  create(@Body() body: { name: string; zoneType?: string; parentZoneId?: string; sortOrder?: number }, @CurrentUser() user: JwtPayload) {
    return this.service.create({ ...body, propertyId: user.propertyId! })
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.PROPERTY_MANAGE)
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.update(id, body as Parameters<ZonesService['update']>[1])
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.PROPERTY_MANAGE)
  remove(@Param('id') id: string) { return this.service.remove(id) }
}
