'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, BookOpen, Search, ChevronRight, BedDouble, CalendarRange, Phone } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { bookingsApi } from '@/lib/api'
import { formatDate, calcNights, cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { CreateBookingDialog } from '@/components/bookings/create-booking-dialog'
import { format, isToday, isTomorrow, isYesterday } from 'date-fns'
import { th } from 'date-fns/locale'

const STATUS_TABS = [
  { value: '', label: 'ทั้งหมด', dot: 'bg-stone-500' },
  { value: 'confirmed', label: 'ยืนยันแล้ว', dot: 'bg-sky-400' },
  { value: 'checked_in', label: 'เข้าพักแล้ว', dot: 'bg-rose-400' },
  { value: 'checked_out', label: 'ออกแล้ว', dot: 'bg-stone-400' },
  { value: 'pending', label: 'รอยืนยัน', dot: 'bg-amber-400' },
  { value: 'cancelled', label: 'ยกเลิก', dot: 'bg-stone-600' },
]

function smartDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isToday(d)) return 'วันนี้'
  if (isTomorrow(d)) return 'พรุ่งนี้'
  if (isYesterday(d)) return 'เมื่อวาน'
  return format(d, 'd MMM', { locale: th })
}

export default function BookingsPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('')
  const [guestSearch, setGuestSearch] = useState('')
  const [page, setPage] = useState(1)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', statusFilter, guestSearch, page],
    queryFn: () => bookingsApi.list({
      status: statusFilter || undefined,
      guestName: guestSearch || undefined,
      page, limit: 20,
    }).then(r => r.data),
    staleTime: 30_000,
  })

  type Booking = {
    id: string
    bookingNumber: string
    status: string
    checkInDate: string
    checkOutDate: string
    adults: number
    children: number
    bookingSource?: { name: string } | null
    guest: { firstName: string; lastName: string; phone?: string | null; nationality?: string | null }
    bookingRooms: Array<{ roomType: { name: string }; room?: { roomNumber: string } | null }>
  }

  const bookings = data?.bookings as Booking[] || []

  return (
    <AppShell title="การจอง" subtitle={data ? `${data.total} รายการ` : 'จัดการการจองห้องพัก'}>
      <div className="space-y-4">

        {/* Search + Create */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <input
              value={guestSearch}
              onChange={e => { setGuestSearch(e.target.value); setPage(1) }}
              placeholder="ค้นหาชื่อ เบอร์โทร..."
              className="h-9 w-full rounded-full border border-white/15 bg-black/25 pl-9 pr-4 text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-300/40 focus:outline-none backdrop-blur-sm transition-colors"
            />
          </div>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" /> สร้างการจอง
            </Button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1) }}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
                statusFilter === tab.value
                  ? 'bg-amber-400/15 border border-amber-300/25 text-amber-200'
                  : 'text-stone-500 hover:text-stone-300 hover:bg-white/[0.05]'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', tab.dot)} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Booking list */}
        <GlassPanel dense padding="none">
          {isLoading ? (
            <div className="divide-y divide-white/5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : !bookings.length ? (
            <EmptyState
              icon={BookOpen}
              title="ไม่พบการจอง"
              description={guestSearch ? `ไม่พบการจองที่ตรงกับ "${guestSearch}"` : 'ยังไม่มีการจองในระบบ'}
              action={<Button size="sm" onClick={() => setCreateDialogOpen(true)}><Plus className="h-4 w-4" /> สร้างการจองแรก</Button>}
              className="py-16"
            />
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {bookings.map((b, i) => {
                const nights = calcNights(b.checkInDate, b.checkOutDate)
                const initials = `${b.guest.firstName[0]}${b.guest.lastName[0]}`
                const roomLabel = b.bookingRooms[0]?.room
                  ? b.bookingRooms[0].room.roomNumber
                  : b.bookingRooms[0]?.roomType?.name || '-'
                const isCheckedIn = b.status === 'checked_in'
                const isToCheck = isToday(new Date(b.checkInDate)) && b.status === 'confirmed'

                const avatarBg = {
                  confirmed: 'bg-sky-400/20 text-sky-300',
                  checked_in: 'bg-rose-400/20 text-rose-300',
                  checked_out: 'bg-stone-400/20 text-stone-400',
                  pending: 'bg-amber-400/20 text-amber-300',
                  cancelled: 'bg-stone-400/10 text-stone-600',
                }[b.status] || 'bg-amber-400/15 text-amber-300'

                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    onClick={() => router.push(`/bookings/${b.id}`)}
                    className={cn(
                      'group flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-all hover:bg-white/[0.04]',
                      isToCheck && 'bg-amber-400/[0.03] hover:bg-amber-400/[0.06]'
                    )}
                  >
                    {/* Guest avatar */}
                    <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold', avatarBg)}>
                      {initials}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-stone-100 text-sm truncate">
                          {b.guest.firstName} {b.guest.lastName}
                        </span>
                        {isToCheck && (
                          <span className="text-[0.625rem] font-bold text-amber-400 bg-amber-400/15 border border-amber-300/25 rounded-full px-1.5 py-0.5 animate-pulse flex-shrink-0">
                            เช็คอินวันนี้
                          </span>
                        )}
                        {b.guest.nationality && b.guest.nationality !== 'ไทย' && (
                          <span className="text-[0.625rem] text-stone-600">{b.guest.nationality}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500 flex-wrap">
                        <span className="font-mono text-amber-400/70">{b.bookingNumber}</span>
                        <span className="flex items-center gap-1">
                          <BedDouble className="h-3 w-3" />
                          {roomLabel}
                          {b.bookingRooms[0]?.room && (
                            <span className="text-stone-600">({b.bookingRooms[0].roomType.name})</span>
                          )}
                        </span>
                        {b.bookingSource && (
                          <span className="text-stone-600">{b.bookingSource.name}</span>
                        )}
                      </div>
                    </div>

                    {/* Date + nights */}
                    <div className="hidden sm:flex flex-col items-end text-right flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-sm text-stone-300">
                        <CalendarRange className="h-3.5 w-3.5 text-stone-600" />
                        <span>{smartDate(b.checkInDate)}</span>
                        <span className="text-stone-600">→</span>
                        <span>{smartDate(b.checkOutDate)}</span>
                      </div>
                      <div className="text-xs text-stone-600 mt-0.5">
                        {b.adults} ผู้ใหญ่{b.children > 0 ? ` ${b.children} เด็ก` : ''} · {nights} คืน
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={b.status} size="sm" />
                      <ChevronRight className="h-4 w-4 text-stone-700 group-hover:text-stone-400 transition-colors" />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </GlassPanel>

        {/* Pagination */}
        {data && data.total > data.limit && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">
              แสดง {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} จาก {data.total} รายการ
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                ← ก่อนหน้า
              </Button>
              <span className="text-xs text-stone-500 w-16 text-center">
                {page} / {Math.ceil(data.total / data.limit)}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total}>
                ถัดไป →
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreateBookingDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => { setCreateDialogOpen(false); qc.invalidateQueries({ queryKey: ['bookings'] }) }}
      />
    </AppShell>
  )
}
