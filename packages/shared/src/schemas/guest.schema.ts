import { z } from 'zod'

export const CreateGuestSchema = z.object({
  firstName: z.string().min(1, 'กรุณาระบุชื่อ').max(100),
  lastName: z.string().min(1, 'กรุณาระบุนามสกุล').max(100),
  phone: z
    .string()
    .regex(/^[0-9+\-\s()]*$/, 'เบอร์โทรไม่ถูกต้อง')
    .optional()
    .or(z.literal('')),
  email: z.string().email('อีเมลไม่ถูกต้อง').optional().or(z.literal('')),
  nationality: z.string().optional(),
  idType: z.enum(['citizen_id', 'passport']).optional(),
  idNumber: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().max(500).optional(),
  remark: z.string().max(500).optional(),
})

export const UpdateGuestSchema = CreateGuestSchema.partial()

export type CreateGuestInput = z.infer<typeof CreateGuestSchema>
export type UpdateGuestInput = z.infer<typeof UpdateGuestSchema>
