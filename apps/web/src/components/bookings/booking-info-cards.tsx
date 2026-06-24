'use client'

import React from 'react'
import { User, CalendarRange, BedDouble } from 'lucide-react'
import { GlassPanel } from '@/components/ui/glass-panel'
import { formatDate, formatCurrency, calcNights } from '@/lib/utils'

interface BookingRoomItem {
  id: string
  roomType: { name: string }
  room?: { roomNumber: string; zone?: { name: string } | null } | null
  rate: number | string
}

interface BookingInfo {
  status: string
  checkInDate: string
  checkOutDate: string
  adults: number
  children: number
  notes?: string | null
  bookingSource?: { name: string } | null
  guest?: { firstName: string; lastName: string; phone?: string | null; email?: string | null; nationality?: string | null } | null
  bookingRooms: BookingRoomItem[]
}

interface BookingInfoCardsProps {
  booking: BookingInfo
  onAssignRoom: (bookingRoomId: string) => void
  onAdjustRate: (bookingRoomId: string, currentRate: number) => void
}

/**
 * Read-only summary cards (guest / booking / rooms) for the booking detail page.
 * Interactions bubble up via callbacks so all mutations stay in the parent.
 */
export function BookingInfoCards({ booking, onAssignRoom, onAdjustRate }: BookingInfoCardsProps) {
  const canAdjustRate = ['confirmed', 'pending', 'checked_in'].includes(booking.status)

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* Guest info */}
      <GlassPanel padding="md">
        <div className="mb-3 flex items-center gap-2">
          <User className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-stone-100">ข้อมูลลูกค้า</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div><span className="text-stone-500">ชื่อ: </span><span className="text-stone-200">{booking.guest?.firstName} {booking.guest?.lastName}</span></div>
          {booking.guest?.phone && <div><span className="text-stone-500">โทร: </span><span className="text-stone-200">{booking.guest.phone}</span></div>}
          {booking.guest?.email && <div><span className="text-stone-500">อีเมล: </span><span className="text-stone-200">{booking.guest.email}</span></div>}
          {booking.guest?.nationality && <div><span className="text-stone-500">สัญชาติ: </span><span className="text-stone-200">{booking.guest.nationality}</span></div>}
        </div>
      </GlassPanel>

      {/* Booking info */}
      <GlassPanel padding="md">
        <div className="mb-3 flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-stone-100">รายละเอียดการจอง</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div><span className="text-stone-500">เช็คอิน: </span><span className="text-stone-200">{formatDate(booking.checkInDate)}</span></div>
          <div><span className="text-stone-500">เช็คเอาท์: </span><span className="text-stone-200">{formatDate(booking.checkOutDate)}</span></div>
          <div><span className="text-stone-500">จำนวนคืน: </span><span className="text-stone-200">{calcNights(booking.checkInDate, booking.checkOutDate)} คืน</span></div>
          <div><span className="text-stone-500">ผู้เข้าพัก: </span><span className="text-stone-200">{booking.adults} ผู้ใหญ่ {booking.children > 0 ? `${booking.children} เด็ก` : ''}</span></div>
          {booking.bookingSource && <div><span className="text-stone-500">ช่องทาง: </span><span className="text-stone-200">{booking.bookingSource.name}</span></div>}
          {booking.notes && <div><span className="text-stone-500">หมายเหตุ: </span><span className="text-stone-300">{booking.notes}</span></div>}
        </div>
      </GlassPanel>

      {/* Room info */}
      <GlassPanel padding="md">
        <div className="mb-3 flex items-center gap-2">
          <BedDouble className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-stone-100">ห้องพัก</h3>
        </div>
        <div className="space-y-3">
          {booking.bookingRooms.map(br => (
            <div key={br.id} className="rounded-xl bg-white/[0.04] p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-stone-200">{br.roomType?.name}</div>
                  {br.room ? (
                    <div className="text-xs text-stone-400 mt-0.5">
                      ห้อง {br.room.roomNumber}{br.room.zone?.name ? ` • ${br.room.zone.name}` : ''}
                    </div>
                  ) : (
                    <span className="mt-1 inline-flex items-center rounded-full border border-stone-600/40 bg-stone-700/30 px-2 py-0.5 text-[10px] text-stone-400">
                      รอกำหนดห้อง
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <div className="text-sm font-semibold text-amber-300">{formatCurrency(Number(br.rate))}</div>
                  <div className="text-xs text-stone-500">ต่อคืน</div>
                </div>
              </div>
              {canAdjustRate && (
                <div className="mt-2">
                  <button
                    onClick={() => onAdjustRate(br.id, Number(br.rate))}
                    className="rounded-lg border border-sky-300/20 bg-sky-400/10 px-2.5 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-400/15 transition-colors"
                    title="ปรับราคา"
                  >
                    ปรับราคา
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  )
}
