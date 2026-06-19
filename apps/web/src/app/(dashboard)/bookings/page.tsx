'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Plus, BookOpen, ChevronRight, BedDouble, CalendarRange,
  List, LayoutGrid, DoorOpen, DoorClosed, Hotel, Clock,
} from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ViewToggle } from '@/components/ui/view-toggle'
import { SearchToggle } from '@/components/ui/search-toggle'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { bookingsApi } from '@/lib/api'
import { calcNights, cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { CreateBookingDialog } from '@/components/bookings/create-booking-dialog'
import { format, addDays, isToday, isTomorrow, isYesterday, formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'

const STATUS_TABS = [
  { value: '', label: 'ทั้งหมด', dot: 'bg-stone-500' },
  { value: 'confirmed', label: 'ยืนยันแล้ว', dot: 'bg-sky-400' },
  { value: 'checked_in', label: 'เข้าพักแล้ว', dot: 'bg-rose-400' },
  { value: 'checked_out', label: 'ออกแล้ว', dot: 'bg-stone-400' },
  { value: 'pending', label: 'รอยืนยัน', dot: 'bg-amber-400' },
  { value: 'cancelled', label: 'ยกเลิก', dot: 'bg-stone-600' },
]

const DATE_CHIPS = [
  { value: '', label: 'ทุกวัน' },
  { value: 'today', label: 'เข้าพักวันนี้' },
  { value: 'week', label: '7 วันข้างหน้า' },
]

// Board columns (active pipeline)
const BOARD_COLUMNS = [
  { status: 'pending', label: 'รอยืนยัน', accent: 'text-amber-300 bg-amber-400/10 border-amber-300/20' },
  { status: 'confirmed', label: 'ยืนยันแล้ว', accent: 'text-sky-300 bg-sky-400/10 border-sky-300/20' },
  { status: 'checked_in', label: 'เข้าพัก', accent: 'text-rose-300 bg-rose-400/10 border-rose-300/20' },
  { status: 'checked_out', label: 'ออกแล้ว', accent: 'text-stone-400 bg-white/[0.04] border-white/10' },
]

const STATUS_ACCENT: Record<string, string> = {
  confirmed: 'bg-sky-400',
  checked_in: 'bg-rose-400',
  pending: 'bg-amber-400',
  checked_out: 'bg-stone-500',
  cancelled: 'bg-stone-700',
}

const AVATAR_BG: Record<string, string> = {
  confirmed: 'bg-sky-400/20 text-sky-300',
  checked_in: 'bg-rose-400/20 text-rose-300',
  checked_out: 'bg-stone-400/20 text-stone-400',
  pending: 'bg-amber-400/20 text-amber-300',
  cancelled: 'bg-stone-400/10 text-stone-600',
}

type Booking = {
  id: string
  bookingNumber: string
  status: string
  checkInDate: string
  checkOutDate: string
  createdAt: string
  adults: number
  children: number
  bookingSource?: { name: string } | null
  guest: { firstName: string; lastName: string; phone?: string | null; nationality?: string | null }
  bookingRooms: Array<{ roomType: { name: string }; room?: { roomNumber: string; zone?: { name: string } | null } | null }>
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr)
  const diffMs = Date.now() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'เมื่อกี้'
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs} ชม.ที่แล้ว`
  if (diffHrs < 48) return 'เมื่อวาน'
  return formatDistanceToNow(d, { locale: th, addSuffix: true })
}

function smartDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isToday(d)) return 'วันนี้'
  if (isTomorrow(d)) return 'พรุ่งนี้'
  if (isYesterday(d)) return 'เมื่อวาน'
  return format(d, 'd MMM', { locale: th })
}

// Room descriptor like the booking detail page: type on top, "ห้อง 208 • Garden Zone" below
function roomInfo(b: Booking): { type: string; detail: string } {
  const br = b.bookingRooms[0]
  const type = br?.roomType?.name || '-'
  const detail = br?.room
    ? `ห้อง ${br.room.roomNumber}${br.room.zone?.name ? ` • ${br.room.zone.name}` : ''}`
    : 'รอจัดห้อง'
  return { type, detail }
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Hotel; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-stone-100 leading-none">{value}</div>
        <div className="text-xs text-stone-500 mt-1 truncate">{label}</div>
      </div>
    </div>
  )
}

export default function BookingsPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('')
  const [guestSearch, setGuestSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // const [sourceFilter, setSourceFilter] = useState('')  // ยังไม่เปิดใช้ — uncomment เมื่อเปิด source filter
  const [dateChip, setDateChip] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'board'>('list')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(guestSearch); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [guestSearch])

  const today = format(new Date(), 'yyyy-MM-dd')
  const weekEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd')
  const dateParams =
    dateChip === 'today' ? { checkInDate: today } :
    dateChip === 'week' ? { checkInFrom: today, checkInTo: weekEnd } :
    {}
  const limit = view === 'board' ? 60 : 20

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', statusFilter, debouncedSearch, dateChip, page, view],
    queryFn: () => bookingsApi.list({
      status: statusFilter || undefined,
      guestName: debouncedSearch || undefined,
      // bookingSourceId: sourceFilter || undefined,
      ...dateParams,
      page, limit,
    }).then(r => r.data),
    staleTime: 30_000,
  })

  const { data: sources = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['booking-sources'],
    queryFn: () => bookingsApi.sources().then(r => r.data),
  })

  // Stat strip — small count queries (read total only)
  const arrivals = useQuery({
    queryKey: ['booking-stat', 'arrivals', today],
    queryFn: () => bookingsApi.list({ checkInDate: today, status: 'confirmed', limit: 1 }).then(r => r.data.total as number),
    refetchInterval: 60_000,
  })
  const inHouse = useQuery({
    queryKey: ['booking-stat', 'inhouse'],
    queryFn: () => bookingsApi.list({ status: 'checked_in', limit: 1 }).then(r => r.data.total as number),
    refetchInterval: 60_000,
  })
  const departures = useQuery({
    queryKey: ['booking-stat', 'departures', today],
    queryFn: () => bookingsApi.list({ checkOutDate: today, status: 'checked_in', limit: 1 }).then(r => r.data.total as number),
    refetchInterval: 60_000,
  })
  const pending = useQuery({
    queryKey: ['booking-stat', 'pending'],
    queryFn: () => bookingsApi.list({ status: 'pending', limit: 1 }).then(r => r.data.total as number),
    refetchInterval: 60_000,
  })

  const bookings = (data?.bookings as Booking[]) || []

  return (
    <AppShell title="การจอง" subtitle={data ? `${data.total} รายการ` : 'จัดการการจองห้องพัก'}>
      <div className="space-y-5">
        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={DoorOpen} label="เข้าพักวันนี้" value={arrivals.data ?? 0} tone="bg-emerald-400/15 text-emerald-300" />
          <StatCard icon={Hotel} label="กำลังพัก" value={inHouse.data ?? 0} tone="bg-rose-400/15 text-rose-300" />
          <StatCard icon={DoorClosed} label="ออกวันนี้" value={departures.data ?? 0} tone="bg-amber-400/15 text-amber-300" />
          <StatCard icon={Clock} label="รอยืนยัน" value={pending.data ?? 0} tone="bg-sky-400/15 text-sky-300" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {/* Source filter — ยังไม่เปิดใช้งาน */}
          {/* <Select value={sourceFilter || 'all'} onValueChange={v => { setSourceFilter(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="h-9 w-40 rounded-full"><SelectValue placeholder="ทุกช่องทาง" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกช่องทาง</SelectItem>
              {sources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select> */}
          <div className="ml-auto flex items-center gap-2">
            <SearchToggle
              value={guestSearch}
              onChange={v => { setGuestSearch(v); setPage(1) }}
              placeholder="ค้นหาชื่อ เบอร์โทร..."
            />
            <ViewToggle
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: 'รายการ', icon: List },
                { value: 'board', label: 'บอร์ด', icon: LayoutGrid },
              ]}
            />
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" /> สร้างการจอง
            </Button>
          </div>
        </div>

        {/* Status tabs + date chips */}
        <div className="flex flex-wrap items-center gap-2">
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
          <span className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />
          <div className="flex gap-1">
            {DATE_CHIPS.map(c => (
              <button key={c.value} onClick={() => { setDateChip(c.value); setPage(1) }}
                className={cn('flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
                  dateChip === c.value ? 'bg-amber-400/15 border border-amber-300/25 text-amber-200' : 'text-stone-500 hover:text-stone-300 hover:bg-white/[0.05]')}>
                {c.value && <CalendarRange className="h-3 w-3" />}{c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-1.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5">
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-48" /><Skeleton className="h-3 w-32" /></div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : !bookings.length ? (
          <EmptyState
            icon={BookOpen}
            title="ไม่พบการจอง"
            description={debouncedSearch ? `ไม่พบการจองที่ตรงกับ "${debouncedSearch}"` : 'ลองล้างตัวกรอง หรือสร้างการจองใหม่'}
            action={<Button size="sm" onClick={() => setCreateDialogOpen(true)}><Plus className="h-4 w-4" /> สร้างการจอง</Button>}
            className="py-16"
          />
        ) : view === 'list' ? (
          <div className="space-y-1.5">
            {bookings.map((b, i) => {
              const nights = calcNights(b.checkInDate, b.checkOutDate)
              const isToCheck = isToday(new Date(b.checkInDate)) && b.status === 'confirmed'
              const r = roomInfo(b)
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.025, 0.3), duration: 0.2 }}
                  onClick={() => router.push(`/bookings/${b.id}`)}
                  className={cn(
                    'group relative flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 cursor-pointer transition-all hover:bg-white/[0.07] hover:border-white/[0.14]',
                    isToCheck && 'border-amber-300/20 bg-amber-400/[0.05] hover:bg-amber-400/[0.08]',
                  )}
                >
                  {/* Status accent left stripe */}
                  <div className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-full', STATUS_ACCENT[b.status] || 'bg-stone-600')} />

                  {/* Avatar */}
                  <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold', AVATAR_BG[b.status] || 'bg-amber-400/15 text-amber-300')}>
                    {b.guest.firstName[0]}{b.guest.lastName[0]}
                  </div>

                  {/* Guest + booking number + created time */}
                  <div className="min-w-0 w-44 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-stone-100 text-sm truncate">{b.guest.firstName} {b.guest.lastName}</span>
                      {isToCheck && (
                        <span className="flex-shrink-0 text-[0.625rem] font-bold text-amber-400 bg-amber-400/15 border border-amber-300/25 rounded-full px-1.5 py-0.5 animate-pulse">
                          วันนี้
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-xs text-amber-400/60">{b.bookingNumber}</span>
                      <span className="text-xs text-stone-700">·</span>
                      <span className="text-xs text-stone-600">{relativeTime(b.createdAt)}</span>
                    </div>
                  </div>

                  {/* Room info */}
                  <div className="hidden md:flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium text-stone-200 truncate">{r.type}</span>
                    <span className="flex items-center gap-1 text-xs text-stone-500 mt-0.5 truncate">
                      <BedDouble className="h-3 w-3 flex-shrink-0 text-stone-600" />
                      {r.detail}
                    </span>
                  </div>

                  {/* Date range */}
                  <div className="hidden lg:flex flex-col items-end flex-shrink-0 text-right min-w-[160px]">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium text-stone-200">{smartDate(b.checkInDate)}</span>
                      <span className="text-stone-600">→</span>
                      <span className="font-medium text-stone-200">{smartDate(b.checkOutDate)}</span>
                    </div>
                    <span className="text-xs text-stone-500 mt-0.5">
                      {nights} คืน · {b.adults} ผู้ใหญ่{b.children > 0 ? ` ${b.children} เด็ก` : ''}
                    </span>
                  </div>

                  {/* Status + arrow */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                    <StatusBadge status={b.status} size="sm" />
                    <ChevronRight className="h-4 w-4 text-stone-700 group-hover:text-stone-300 transition-colors" />
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          /* Board view */
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {BOARD_COLUMNS.map(col => {
              const items = bookings.filter(b => b.status === col.status)
              return (
                <div key={col.status} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-2.5">
                  <div className={cn('mb-2.5 flex items-center justify-between rounded-xl border px-3 py-2', col.accent)}>
                    <span className="text-xs font-bold">{col.label}</span>
                    <span className="text-xs font-bold opacity-70">{items.length}</span>
                  </div>
                  {/* Cap height so a busy column scrolls instead of stretching the page */}
                  <div className="flex flex-col gap-2 max-h-[calc(100vh-360px)] min-h-[80px] overflow-y-auto pr-0.5">
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/[0.06] py-6 text-center text-xs text-stone-600">ว่าง</div>
                    ) : items.map(b => {
                      const nights = calcNights(b.checkInDate, b.checkOutDate)
                      const r = roomInfo(b)
                      return (
                        <button key={b.id} onClick={() => router.push(`/bookings/${b.id}`)}
                          className="group rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition-all hover:bg-white/[0.07] hover:border-white/20">
                          <div className="flex items-center gap-2">
                            <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold', AVATAR_BG[b.status] || 'bg-amber-400/15 text-amber-300')}>
                              {b.guest.firstName[0]}{b.guest.lastName[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-stone-100 truncate">{b.guest.firstName} {b.guest.lastName}</div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs text-amber-400/70">{b.bookingNumber}</span>
                                <span className="text-xs text-stone-700">· {relativeTime(b.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs">
                            <div className="text-stone-300 truncate">{r.type}</div>
                            <div className="mt-0.5 flex items-center justify-between text-stone-500">
                              <span className="flex items-center gap-1 truncate"><BedDouble className="h-3 w-3 flex-shrink-0" /> {r.detail}</span>
                              <span className="flex items-center gap-1 flex-shrink-0"><CalendarRange className="h-3 w-3" /> {smartDate(b.checkInDate)} · {nights}ค</span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination (list view only) */}
        {view === 'list' && data && data.total > data.limit && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">
              แสดง {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} จาก {data.total} รายการ
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                ← ก่อนหน้า
              </Button>
              <span className="text-xs text-stone-500 w-16 text-center">{page} / {Math.ceil(data.total / data.limit)}</span>
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
        onSuccess={() => {
          setCreateDialogOpen(false)
          qc.invalidateQueries({ queryKey: ['bookings'] })
          qc.invalidateQueries({ queryKey: ['booking-stat'] })
          qc.invalidateQueries({ queryKey: ['room-grid'] })
          qc.invalidateQueries({ queryKey: ['room-map'] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
          qc.invalidateQueries({ queryKey: ['occupancy-forecast'] })
        }}
      />
    </AppShell>
  )
}
