import { z } from 'zod'

export const CreateBookingSchema = z
  .object({
    guestId: z.string().optional(),
    newGuest: z
      .object({
        firstName: z.string().min(1, 'กรุณาระบุชื่อ'),
        lastName: z.string().min(1, 'กรุณาระบุนามสกุล'),
        phone: z.string().optional(),
        email: z.string().email('อีเมลไม่ถูกต้อง').optional().or(z.literal('')),
        nationality: z.string().optional(),
        idType: z.enum(['citizen_id', 'passport']).optional(),
        idNumber: z.string().optional(),
      })
      .optional(),
    roomTypeId: z.string().min(1, 'กรุณาเลือกประเภทห้อง'),
    checkInDate: z.string().min(1, 'กรุณาระบุวันเข้าพัก'),
    checkOutDate: z.string().min(1, 'กรุณาระบุวันออก'),
    adults: z.number().int().min(1, 'ต้องมีผู้ใหญ่อย่างน้อย 1 คน').max(20),
    children: z.number().int().min(0).max(20),
    rate: z.number().min(0, 'ราคาต้องไม่ติดลบ'),
    bookingSourceId: z.string().optional(),
    notes: z.string().max(500).optional(),
    packageName: z.string().optional(),
    packageNote: z.string().optional(),
  })
  .refine(
    (data) => {
      const checkIn = new Date(data.checkInDate)
      const checkOut = new Date(data.checkOutDate)
      return checkOut > checkIn
    },
    {
      message: 'วันออกต้องหลังวันเข้าพัก',
      path: ['checkOutDate'],
    }
  )
  .refine((data) => data.guestId || data.newGuest, {
    message: 'กรุณาระบุข้อมูลลูกค้า',
    path: ['guestId'],
  })

export const UpdateBookingSchema = z.object({
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  adults: z.number().int().min(1).max(20).optional(),
  children: z.number().int().min(0).max(20).optional(),
  rate: z.number().min(0).optional(),
  bookingSourceId: z.string().optional(),
  notes: z.string().max(500).optional(),
  packageName: z.string().optional(),
  packageNote: z.string().optional(),
})

export const AssignRoomSchema = z.object({
  roomId: z.string().min(1, 'กรุณาเลือกห้อง'),
  bookingRoomId: z.string().min(1),
})

export const CancelBookingSchema = z.object({
  reason: z.string().min(1, 'กรุณาระบุเหตุผล').max(500),
  refundAmount: z.number().min(0).optional(),
  cancellationFee: z.number().min(0).optional(),
})

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>
export type UpdateBookingInput = z.infer<typeof UpdateBookingSchema>
export type AssignRoomInput = z.infer<typeof AssignRoomSchema>
export type CancelBookingInput = z.infer<typeof CancelBookingSchema>
