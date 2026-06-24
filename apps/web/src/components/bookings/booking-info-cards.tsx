'use client'

import React from 'react'
import { User, CalendarRange, BedDouble, ExternalLink, Pencil } from 'lucide-react'
import Link from 'next/link'
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
  guest?: { id: string; firstName: string; lastName: string; phone?: string | null; email?: string | null; nationality?: string | null } | null
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
  const canReassign = ['confirmed', 'pending'].includes(booking.status)

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* Guest info */}
      <GlassPanel padding="md">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-stone-100">ข้อมูลลูกค้า</h3>
          </div>
          {booking.guest?.id && (
            <Link href={`/guests/${booking.guest.id}`}
              className="flex items-center gap-1 text-[10px] text-stone-500 hover:text-amber-300 transition-colors">
              <ExternalLink className="h-3 w-3" /> โปรไฟล์
            </Link>
          )}
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
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-stone-400">
                        ห้อง {br.room.roomNumber}{br.room.zone?.name ? ` • ${br.room.zone.name}` : ''}
                      </span>
                      {canReassign && (
                        <button
                          onClick={() => onAssignRoom(br.id)}
                          className="text-[10px] text-sky-400/70 hover:text-sky-300 transition-colors underline underline-offset-2"
                        >
                          เปลี่ยน
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="mt-1 inline-flex items-center rounded-full border border-stone-600/40 bg-stone-700/30 px-2 py-0.5 text-[10px] text-stone-400">
                      รอกำหนดห้อง
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-sm font-semibold text-amber-300">{formatCurrency(Number(br.rate))}</span>
                    {canAdjustRate && (
                      <button
                        onClick={() => onAdjustRate(br.id, Number(br.rate))}
                        className="text-stone-600 hover:text-sky-300 transition-colors"
                        title="ปรับราคา"
                        aria-label="ปรับราคา"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-stone-500">ต่อคืน</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  )
}
