'use client'

import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, BookOpen, Search, Filter, CalendarRange, User } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { bookingsApi, guestsApi, roomTypesApi } from '@/lib/api'
import { formatDate, formatCurrency, calcNights } from '@/lib/utils'
import Link from 'next/link'
import { CreateBookingDialog } from '@/components/bookings/create-booking-dialog'

const STATUS_OPTIONS = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'pending', label: 'รอยืนยัน' },
  { value: 'confirmed', label: 'ยืนยันแล้ว' },
  { value: 'checked_in', label: 'เข้าพักแล้ว' },
  { value: 'checked_out', label: 'ออกแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
]

export default function BookingsPage() {
  const qc = useQueryClient()
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

  return (
    <AppShell
      title="การจอง"
      subtitle="จัดการการจองห้องพัก"
      headerActions={<Button onClick={() => setCreateDialogOpen(true)}><Plus className="h-4 w-4" /> สร้างการจอง</Button>}
    >
      <div className="space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <input
              value={guestSearch}
              onChange={e => { setGuestSearch(e.target.value); setPage(1) }}
              placeholder="ค้นหาชื่อลูกค้า..."
              className="h-9 w-48 rounded-full border border-white/15 bg-black/25 pl-9 pr-4 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-300/40 focus:outline-none backdrop-blur-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="สถานะ" /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <GlassPanel dense padding="none">
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : !data?.bookings?.length ? (
            <EmptyState icon={BookOpen} title="ไม่พบการจอง" description={guestSearch ? `ไม่พบการจองของ "${guestSearch}"` : 'ยังไม่มีการจองในระบบ'} action={<Button onClick={() => setCreateDialogOpen(true)}><Plus className="h-4 w-4" /> สร้างการจอง</Button>} className="m-4" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">หมายเลขจอง</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ลูกค้า</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ห้อง</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Check-out</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">คืน</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">สถานะ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">จัดการ</th>
                </tr></thead>
                <tbody>
                  {(data.bookings as Array<{
                    id: string; bookingNumber: string
                    guest: { firstName: string; lastName: string }
                    checkInDate: string; checkOutDate: string
                    bookingRooms: Array<{ roomType: { name: string }; room?: { roomNumber: string } | null }>
                    status: string
                  }>).map(b => (
                    <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 font-mono text-amber-300 text-xs">{b.bookingNumber}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-stone-600" />
                          <span className="font-medium text-stone-200">{b.guest.firstName} {b.guest.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-400">
                        {b.bookingRooms[0]?.room ? `${b.bookingRooms[0].room.roomNumber} (${b.bookingRooms[0].roomType.name})` : b.bookingRooms[0]?.roomType?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-stone-300">{formatDate(b.checkInDate, 'dd/MM/yy')}</td>
                      <td className="px-4 py-3 text-stone-300">{formatDate(b.checkOutDate, 'dd/MM/yy')}</td>
                      <td className="px-4 py-3 text-right text-stone-400">{calcNights(b.checkInDate, b.checkOutDate)}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} size="sm" /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/bookings/${b.id}`}>
                          <Button variant="ghost" size="sm">ดูรายละเอียด</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>

        {data && data.total > data.limit && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>← ก่อนหน้า</Button>
            <span className="text-sm text-stone-400">หน้า {page} / {Math.ceil(data.total / data.limit)}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage(p => p+1)} disabled={page*data.limit >= data.total}>ถัดไป →</Button>
          </div>
        )}
      </div>

      <CreateBookingDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} onSuccess={() => { setCreateDialogOpen(false); qc.invalidateQueries({ queryKey: ['bookings'] }) }} />
    </AppShell>
  )
}
