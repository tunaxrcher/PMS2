import { z } from 'zod'

export const LoginPhoneSchema = z.object({
  phone: z
    .string()
    .min(9, 'เบอร์โทรไม่ถูกต้อง')
    .max(15, 'เบอร์โทรไม่ถูกต้อง')
    .regex(/^[0-9+\-\s()]+$/, 'เบอร์โทรไม่ถูกต้อง'),
})

export const LoginPinSchema = z.object({
  phone: z.string(),
  pin: z
    .string()
    .length(6, 'PIN ต้องมี 6 หลัก')
    .regex(/^\d{6}$/, 'PIN ต้องเป็นตัวเลขเท่านั้น'),
})

export const ChangePinSchema = z
  .object({
    currentPin: z.string().length(6, 'PIN ต้องมี 6 หลัก'),
    newPin: z
      .string()
      .length(6, 'PIN ต้องมี 6 หลัก')
      .regex(/^\d{6}$/, 'PIN ต้องเป็นตัวเลขเท่านั้น'),
    confirmPin: z.string().length(6, 'PIN ต้องมี 6 หลัก'),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    message: 'PIN ไม่ตรงกัน',
    path: ['confirmPin'],
  })
  .refine((data) => data.newPin !== '000000', {
    message: 'ไม่สามารถใช้ PIN เริ่มต้นได้',
    path: ['newPin'],
  })

export type LoginPhoneInput = z.infer<typeof LoginPhoneSchema>
export type LoginPinInput = z.infer<typeof LoginPinSchema>
export type ChangePinInput = z.infer<typeof ChangePinSchema>
