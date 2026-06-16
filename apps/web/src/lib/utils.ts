import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays } from 'date-fns'
import { th } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatDate(date: Date | string, fmt = 'dd MMM yyyy'): string {
  return format(new Date(date), fmt, { locale: th })
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'dd MMM yyyy HH:mm', { locale: th })
}

export function calcNights(checkIn: Date | string, checkOut: Date | string): number {
  return differenceInDays(new Date(checkOut), new Date(checkIn))
}

export function maskId(idNumber: string): string {
  if (!idNumber) return ''
  if (idNumber.length <= 4) return '****'
  return '*'.repeat(idNumber.length - 4) + idNumber.slice(-4)
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}
