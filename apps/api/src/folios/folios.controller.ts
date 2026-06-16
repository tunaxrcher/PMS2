import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'
import { FoliosService } from './folios.service'
import { PERMISSIONS } from '../common/permissions'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('folios')
export class FoliosController {
  constructor(private service: FoliosService) {}

  @Get(':id')
  @RequirePermissions(PERMISSIONS.FOLIO_VIEW)
  findOne(@Param('id') id: string) { return this.service.findOne(id) }

  @Get(':id/summary')
  @RequirePermissions(PERMISSIONS.FOLIO_VIEW)
  getSummary(@Param('id') id: string) { return this.service.getSummary(id) }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FOLIO_CLOSE)
  closeFolio(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.closeFolio(id, user.sub)
  }

  @Patch('items/:itemId/void')
  @RequirePermissions(PERMISSIONS.FOLIO_ADD_CHARGE)
  voidItem(@Param('itemId') itemId: string, @CurrentUser() user: JwtPayload) {
    return this.service.voidItem(itemId, user.sub)
  }

  @Post(':id/charges')
  @RequirePermissions(PERMISSIONS.FOLIO_ADD_CHARGE)
  addCharge(@Param('id') id: string, @Body() body: Parameters<FoliosService['addCharge']>[1], @CurrentUser() user: JwtPayload) {
    return this.service.addCharge(id, body, user.sub)
  }

  @Post(':id/discounts')
  @RequirePermissions(PERMISSIONS.FOLIO_ADD_DISCOUNT)
  addDiscount(@Param('id') id: string, @Body() body: Parameters<FoliosService['addDiscount']>[1], @CurrentUser() user: JwtPayload) {
    return this.service.addDiscount(id, body, user.sub)
  }

  @Post(':id/payments')
  @RequirePermissions(PERMISSIONS.PAYMENT_RECEIVE)
  addPayment(@Param('id') id: string, @Body() body: Parameters<FoliosService['addPayment']>[1], @CurrentUser() user: JwtPayload) {
    return this.service.addPayment(id, body, user.sub)
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private service: FoliosService) {}

  @Post(':id/void')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.PAYMENT_VOID)
  voidPayment(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: JwtPayload) {
    return this.service.voidPayment(id, body.reason, user.sub)
  }

  @Post(':id/refund')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.PAYMENT_REFUND)
  refundPayment(@Param('id') id: string, @Body() body: { amount: number; reason: string }, @CurrentUser() user: JwtPayload) {
    return this.service.refundPayment(id, body, user.sub)
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('deposits')
export class DepositsController {
  constructor(private service: FoliosService) {}

  @Post('booking/:bookingId')
  @RequirePermissions(PERMISSIONS.DEPOSIT_RECEIVE)
  addDeposit(@Param('bookingId') bookingId: string, @Body() body: Parameters<FoliosService['addDeposit']>[1], @CurrentUser() user: JwtPayload) {
    return this.service.addDeposit(bookingId, body, user.sub)
  }

  @Post(':id/apply')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.DEPOSIT_APPLY)
  applyDeposit(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.applyDeposit(id, user.sub)
  }

  @Post(':id/refund')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.DEPOSIT_REFUND)
  refundDeposit(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: JwtPayload) {
    return this.service.refundDeposit(id, body.reason, user.sub)
  }
}
