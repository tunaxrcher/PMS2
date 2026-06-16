import { z } from 'zod'
import { PaymentMethod } from '../types/enums'

export const AddPaymentSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod),
  amount: z.number().positive('จำนวนเงินต้องมากกว่า 0'),
  referenceNo: z.string().max(100).optional(),
})

export const AddChargeSchema = z.object({
  itemType: z.string().min(1),
  description: z.string().min(1, 'กรุณาระบุรายการ').max(200),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  serviceDate: z.string(),
})

export const AddDiscountSchema = z.object({
  description: z.string().min(1, 'กรุณาระบุเหตุผล').max(200),
  amount: z.number().positive('ส่วนลดต้องมากกว่า 0'),
  serviceDate: z.string(),
})

export const RefundSchema = z.object({
  amount: z.number().positive('จำนวนเงินต้องมากกว่า 0'),
  reason: z.string().min(1, 'กรุณาระบุเหตุผล').max(500),
})

export const VoidPaymentSchema = z.object({
  reason: z.string().min(1, 'กรุณาระบุเหตุผล').max(500),
})

export const AddDepositSchema = z.object({
  amount: z.number().positive('จำนวนเงินต้องมากกว่า 0'),
  depositType: z.enum(['booking_deposit', 'keycard_deposit', 'damage_deposit']),
  paymentMethod: z.nativeEnum(PaymentMethod),
  referenceNo: z.string().max(100).optional(),
})

export type AddPaymentInput = z.infer<typeof AddPaymentSchema>
export type AddChargeInput = z.infer<typeof AddChargeSchema>
export type AddDiscountInput = z.infer<typeof AddDiscountSchema>
export type RefundInput = z.infer<typeof RefundSchema>
export type VoidPaymentInput = z.infer<typeof VoidPaymentSchema>
export type AddDepositInput = z.infer<typeof AddDepositSchema>
