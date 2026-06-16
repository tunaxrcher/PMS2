import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { UsersService } from './users.service'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  findAll(@CurrentUser() user: JwtPayload) {
    return this.usersService.findAll(user.propertyId!)
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  create(@Body() body: { phone: string; firstName: string; lastName: string; roleName: string }, @CurrentUser() user: JwtPayload) {
    return this.usersService.create({ ...body, propertyId: user.propertyId! })
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  update(@Param('id') id: string, @Body() body: { firstName?: string; lastName?: string; active?: boolean; roleName?: string }) {
    return this.usersService.update(id, body)
  }

  @Post(':id/reset-pin')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  resetPin(@Param('id') id: string) {
    return this.usersService.resetPin(id)
  }
}
