import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class FoliosService {
  constructor(private prisma: PrismaService) {}

  // ── Tenant-isolation helpers ──────────────────────────────────
  // Resolve & verify a folio belongs to the caller's property.
  private async assertFolioProperty(folioId: string, propertyId: string) {
    const folio = await this.prisma.folio.findUnique({
      where: { id: folioId },
      include: { booking: { select: { propertyId: true } } },
    })
    if (!folio || folio.booking.propertyId !== propertyId) throw new NotFoundException('ไม่พบ Folio')
    return folio
  }

  private async assertPaymentProperty(paymentId: string, propertyId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { folio: { include: { booking: { select: { propertyId: true } } } }, refunds: true },
    })
    if (!payment || payment.folio.booking.propertyId !== propertyId) throw new NotFoundException('ไม่พบรายการชำระเงิน')
    return payment
  }

  private async assertDepositProperty(depositId: string, propertyId: string) {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      include: { booking: { select: { propertyId: true } } },
    })
    if (!deposit || deposit.booking.propertyId !== propertyId) throw new NotFoundException('ไม่พบมัดจำ')
    return deposit
  }

  async findOne(id: string, propertyId: string) {
    const folio = await this.prisma.folio.findUnique({
      where: { id },
      include: {
        items: { where: { isVoided: false }, orderBy: { serviceDate: 'asc' } },
        payments: { include: { refunds: true } },
        deposits: true,
        booking: { include: { guest: true } },
      },
    })
    if (!folio || folio.booking.propertyId !== propertyId) throw new NotFoundException('ไม่พบ Folio')
    return folio
  }

  async addCharge(folioId: string, data: {
    itemType: string
    description: string
    quantity: number
    unitPrice: number
    serviceDate: string
  }, createdBy: string, propertyId: string) {
    const folio = await this.assertFolioProperty(folioId, propertyId)
    if (folio.status !== 'open') throw new BadRequestException('Folio ถูกปิดแล้ว')

    return this.prisma.folioItem.create({
      data: {
        folioId,
        itemType: data.itemType,
        description: data.description,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalAmount: data.quantity * data.unitPrice,
        serviceDate: new Date(data.serviceDate),
        createdBy,
      },
    })
  }

  async addDiscount(folioId: string, data: {
    description: string
    amount: number
    serviceDate: string
  }, createdBy: string, propertyId: string) {
    const folio = await this.assertFolioProperty(folioId, propertyId)
    if (folio.status !== 'open') throw new BadRequestException('Folio ถูกปิดแล้ว')

    return this.prisma.folioItem.create({
      data: {
        folioId,
        itemType: 'discount',
        description: data.description,
        quantity: 1,
        unitPrice: -data.amount,
        totalAmount: -data.amount,
        serviceDate: new Date(data.serviceDate),
        createdBy,
      },
    })
  }

  async voidItem(itemId: string, voidedBy: string, propertyId: string) {
    const item = await this.prisma.folioItem.findUnique({
      where: { id: itemId },
      include: { folio: { include: { booking: { select: { propertyId: true } } } } },
    })
    if (!item || item.folio.booking.propertyId !== propertyId) throw new NotFoundException('ไม่พบรายการ')
    if (item.isVoided) throw new BadRequestException('รายการนี้ถูก Void แล้ว')

    await this.prisma.auditLog.create({
      data: { userId: voidedBy, action: 'FOLIO_ITEM_VOID', entityType: 'folio_item', entityId: itemId },
    })

    return this.prisma.folioItem.update({ where: { id: itemId }, data: { isVoided: true } })
  }

  async addPayment(folioId: string, data: {
    paymentMethod: string
    amount: number
    referenceNo?: string
    slipUrl?: string
  }, receivedBy: string, propertyId: string) {
    const folio = await this.assertFolioProperty(folioId, propertyId)
    if (folio.status !== 'open') throw new BadRequestException('Folio ถูกปิดแล้ว')
    if (data.amount <= 0) throw new BadRequestException('จำนวนเงินต้องมากกว่า 0')

    const payment = await this.prisma.payment.create({
      data: {
        folioId,
        paymentMethod: data.paymentMethod,
        amount: data.amount,
        referenceNo: data.referenceNo,
        slipUrl: data.slipUrl,
        receivedBy,
        status: 'paid',
      },
    })

    await this.prisma.auditLog.create({
      data: {
        userId: receivedBy,
        action: 'PAYMENT_RECEIVE',
        entityType: 'payment',
        entityId: payment.id,
        newValueJson: { amount: data.amount, method: data.paymentMethod },
      },
    })

    return payment
  }

  async voidPayment(paymentId: string, reason: string, voidedBy: string, propertyId: string) {
    const payment = await this.assertPaymentProperty(paymentId, propertyId)
    if (payment.status !== 'paid') throw new BadRequestException('ไม่สามารถ Void รายการนี้ได้')

    const updated = await this.prisma.payment.update({ where: { id: paymentId }, data: { status: 'voided' } })

    await this.prisma.auditLog.create({
      data: {
        userId: voidedBy,
        action: 'PAYMENT_VOID',
        entityType: 'payment',
        entityId: paymentId,
        newValueJson: { reason },
      },
    })

    return updated
  }

  async refundPayment(paymentId: string, data: { amount: number; reason: string }, refundedBy: string, propertyId: string) {
    const payment = await this.assertPaymentProperty(paymentId, propertyId)
    if (!['paid', 'partial_refunded'].includes(payment.status)) throw new BadRequestException('ไม่สามารถคืนเงินรายการนี้ได้')

    // Check cumulative refunds don't exceed payment amount
    const totalRefunded = payment.refunds.reduce((sum, r) => sum + Number(r.amount), 0)
    if (totalRefunded + data.amount > Number(payment.amount)) {
      throw new BadRequestException(`คืนเงินได้อีกสูงสุด ฿${(Number(payment.amount) - totalRefunded).toFixed(2)}`)
    }

    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          paymentId,
          amount: data.amount,
          reason: data.reason,
          refundedBy,
        },
      })

      const isFullRefund = data.amount >= Number(payment.amount)
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: isFullRefund ? 'refunded' : 'partial_refunded' },
      })

      await tx.auditLog.create({
        data: {
          userId: refundedBy,
          action: 'PAYMENT_REFUND',
          entityType: 'payment',
          entityId: paymentId,
          newValueJson: { refundAmount: data.amount, reason: data.reason },
        },
      })

      return refund
    })
  }

  async addDeposit(bookingId: string, data: {
    amount: number
    depositType: string
    paymentMethod: string
    referenceNo?: string
    remark?: string
  }, receivedBy: string, propertyId: string) {
    const bookingWithFolio = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { folios: true },
    })
    if (!bookingWithFolio || bookingWithFolio.propertyId !== propertyId) throw new NotFoundException('ไม่พบการจอง')

    const folioId = bookingWithFolio.folios[0]?.id

    const deposit = await this.prisma.deposit.create({
      data: {
        bookingId,
        folioId,
        amount: data.amount,
        depositType: data.depositType,
        paymentMethod: data.paymentMethod,
        status: 'held',
        receivedBy,
        referenceNo: data.referenceNo,
        remark: data.remark,
      },
    })

    // Auto-confirm Pending booking when deposit is received
    const pendingCheck = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, propertyId: true } })
    if (pendingCheck?.status === 'pending') {
      await this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'confirmed' } })
      await this.prisma.auditLog.create({
        data: { propertyId: pendingCheck.propertyId, userId: receivedBy, action: 'BOOKING_AUTO_CONFIRM', entityType: 'booking', entityId: bookingId, newValueJson: { reason: 'รับมัดจำ auto-confirm' } },
      })
    }

    return deposit
  }

  async applyDeposit(depositId: string, appliedBy: string, propertyId: string) {
    const deposit = await this.assertDepositProperty(depositId, propertyId)
    if (deposit.status !== 'held') throw new BadRequestException('มัดจำนี้ไม่สามารถนำมาใช้ได้')
    return this.prisma.deposit.update({ where: { id: depositId }, data: { status: 'applied' } })
  }

  async refundDeposit(depositId: string, reason: string, refundedBy: string, propertyId: string) {
    const deposit = await this.assertDepositProperty(depositId, propertyId)
    if (deposit.status !== 'held') throw new BadRequestException('มัดจำนี้ไม่สามารถคืนได้')
    return this.prisma.deposit.update({ where: { id: depositId }, data: { status: 'refunded' } })
  }

  async closeFolio(folioId: string, closedBy: string, propertyId: string) {
    const folio = await this.prisma.folio.findUnique({
      where: { id: folioId },
      include: {
        items: { where: { isVoided: false } },
        payments: { include: { refunds: true } },
        deposits: true,
        booking: { select: { propertyId: true } },
      },
    })
    if (!folio || folio.booking.propertyId !== propertyId) throw new NotFoundException('ไม่พบ Folio')
    if (folio.status !== 'open') throw new BadRequestException('Folio ถูกปิดแล้ว')

    const totalCharges = folio.items.reduce((sum, i) => sum + Number(i.totalAmount), 0)
    const totalPayments = folio.payments
      .filter(p => p.status === 'paid' || p.status === 'partial_refunded')
      .reduce((sum, p) => {
        const refunded = p.refunds.reduce((rs, r) => rs + Number(r.amount), 0)
        return sum + Number(p.amount) - refunded
      }, 0)
    const totalDeposits = folio.deposits
      .filter(d => d.status === 'applied' || d.status === 'held')
      .reduce((sum, d) => sum + Number(d.amount), 0)
    const balance = totalCharges - totalPayments - totalDeposits

    if (balance > 0.01) {
      throw new BadRequestException(`ยังมียอดค้างชำระ ฿${balance.toFixed(2)} ไม่สามารถปิด Folio ได้`)
    }

    // Auto-apply held deposits on close (consistent with checkout)
    await this.prisma.deposit.updateMany({
      where: { folioId, status: 'held' },
      data: { status: 'applied' },
    })

    await this.prisma.auditLog.create({
      data: { userId: closedBy, action: 'FOLIO_CLOSE', entityType: 'folio', entityId: folioId },
    })

    return this.prisma.folio.update({
      where: { id: folioId },
      data: { status: 'closed', closedAt: new Date() },
    })
  }

  async getSummary(folioId: string, propertyId: string) {
    const folio = await this.prisma.folio.findUnique({
      where: { id: folioId },
      include: {
        items: { where: { isVoided: false } },
        payments: { include: { refunds: true } },
        deposits: true,
        booking: { select: { id: true, propertyId: true } },
      },
    })
    if (!folio || folio.booking.propertyId !== propertyId) throw new NotFoundException('ไม่พบ Folio')

    const totalCharges = folio.items.reduce((sum, i) => sum + Number(i.totalAmount), 0)

    // Net payments = paid - refunded amounts
    const totalPayments = folio.payments
      .filter(p => p.status === 'paid' || p.status === 'partial_refunded')
      .reduce((sum, p) => {
        const paid = Number(p.amount)
        const refunded = p.refunds.reduce((rs, r) => rs + Number(r.amount), 0)
        return sum + (paid - refunded)
      }, 0)

    // Deposits: applied + held (both reduce balance — held is pre-committed)
    const totalDepositsApplied = folio.deposits
      .filter(d => d.status === 'applied')
      .reduce((sum, d) => sum + Number(d.amount), 0)

    const totalDepositsHeld = folio.deposits
      .filter(d => d.status === 'held')
      .reduce((sum, d) => sum + Number(d.amount), 0)

    const balance = totalCharges - totalPayments - totalDepositsApplied

    return {
      totalCharges,
      totalPayments,
      totalDepositsApplied,
      totalDepositsHeld,
      balance,
      balanceAfterHeld: Math.max(0, balance - totalDepositsHeld),
    }
  }
}
