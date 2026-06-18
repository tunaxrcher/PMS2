import React from 'react'
import { cn } from '@/lib/utils'

type StatusKey =
  | 'clean' | 'dirty' | 'occupied' | 'cleaning' | 'inspected'
  | 'out_of_order' | 'out_of_service'
  | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show' | 'pending'
  | 'open' | 'closed' | 'voided'
  | 'paid' | 'refunded' | 'partial_refunded'
  | 'maintenance'
  | 'in_progress' | 'done'
  | 'held' | 'applied' | 'forfeited'
  | 'low' | 'medium' | 'high' | 'urgent'
  | 'open_ticket' | 'resolved'

interface StatusConfig {
  label: string
  className: string
}

const statusMap: Record<string, StatusConfig> = {
  // Room status
  clean: { label: 'สะอาด', className: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/20' },
  dirty: { label: 'ยังไม่ได้ทำ', className: 'bg-amber-400/15 text-amber-200 border-amber-300/20' },
  occupied: { label: 'มีผู้เข้าพัก', className: 'bg-rose-400/15 text-rose-200 border-rose-300/20' },
  cleaning: { label: 'กำลังทำ', className: 'bg-sky-400/15 text-sky-200 border-sky-300/20' },
  inspected: { label: 'ตรวจแล้ว', className: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/20' },
  out_of_order: { label: 'ห้องเสีย', className: 'bg-stone-400/15 text-stone-300 border-stone-300/20' },
  out_of_service: { label: 'ปิดบริการ', className: 'bg-stone-400/10 text-stone-400 border-stone-300/15' },

  // Booking status
  pending: { label: 'รอยืนยัน', className: 'bg-amber-400/15 text-amber-200 border-amber-300/20' },
  confirmed: { label: 'ยืนยันแล้ว', className: 'bg-sky-400/15 text-sky-200 border-sky-300/20' },
  checked_in: { label: 'เข้าพักแล้ว', className: 'bg-rose-400/15 text-rose-200 border-rose-300/20' },
  checked_out: { label: 'ออกแล้ว', className: 'bg-stone-400/15 text-stone-300 border-stone-300/20' },
  cancelled: { label: 'ยกเลิก', className: 'bg-stone-400/10 text-stone-400 border-stone-300/15' },
  no_show: { label: 'ไม่มา', className: 'bg-rose-400/10 text-rose-400 border-rose-300/15' },

  // Folio status
  open: { label: 'เปิด', className: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/20' },
  closed: { label: 'ปิดแล้ว', className: 'bg-stone-400/15 text-stone-300 border-stone-300/20' },
  voided: { label: 'ยกเลิก', className: 'bg-rose-400/10 text-rose-400 border-rose-300/15' },

  // Payment status
  paid: { label: 'ชำระแล้ว', className: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/20' },
  refunded: { label: 'คืนเงิน', className: 'bg-violet-400/15 text-violet-200 border-violet-300/20' },
  partial_refunded: { label: 'คืนบางส่วน', className: 'bg-violet-400/10 text-violet-300 border-violet-300/15' },

  // Housekeeping
  in_progress: { label: 'กำลังทำ', className: 'bg-sky-400/15 text-sky-200 border-sky-300/20' },
  done: { label: 'เสร็จแล้ว', className: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/20' },
  maintenance: { label: 'แจ้งซ่อม', className: 'bg-orange-400/15 text-orange-200 border-orange-300/20' },

  // Deposit
  held: { label: 'ถือไว้', className: 'bg-amber-400/15 text-amber-200 border-amber-300/20' },
  applied: { label: 'นำมาใช้', className: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/20' },
  forfeited: { label: 'ริบ', className: 'bg-rose-400/15 text-rose-200 border-rose-300/20' },

  // Priority
  low: { label: 'ต่ำ', className: 'bg-stone-400/15 text-stone-300 border-stone-300/20' },
  medium: { label: 'ปานกลาง', className: 'bg-amber-400/15 text-amber-200 border-amber-300/20' },
  high: { label: 'สูง', className: 'bg-orange-400/15 text-orange-200 border-orange-300/20' },
  urgent: { label: 'ด่วนมาก', className: 'bg-rose-400/15 text-rose-200 border-rose-300/20' },

  // Maintenance ticket
  open_ticket: { label: 'เปิด', className: 'bg-amber-400/15 text-amber-200 border-amber-300/20' },
  resolved: { label: 'แก้ไขแล้ว', className: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/20' },
}

interface StatusBadgeProps {
  status: string
  className?: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const config = statusMap[status] || { label: status, className: 'bg-stone-400/15 text-stone-300 border-stone-300/20' }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
