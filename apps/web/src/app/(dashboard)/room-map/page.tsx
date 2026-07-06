'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { format, addDays, parseISO, isToday, isTomorrow } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, Plus,
  AlertTriangle, BedDouble,
} from 'lucide-react'

import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Input } from '@/components/ui/input'
import { roomsApi, zonesApi, roomTypesApi, housekeepingApi } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { CreateBookingDialog } from '@/components/bookings/create-booking-dialog'
import { RoomFilterPanel } from '@/components/rooms/room-filter-panel'
import { ROOM_STATUS, OOO_STATUSES, MAP_STATUS_KEYS, buildStatusChips } from '@/lib/room-status'

const STATUS_CHIPS = buildStatusChips(MAP_STATUS_KEYS)

interface RoomData {
  id: string; roomNumber: string; roomName?: string | null; currentStatus: string; dateStatus: string
  isOverstay?: boolean
  roomType: { id: string; name: string; imageUrl?: string | null; baseRate: number | string }
  zone?: { id: string; name: string; imageUrl?: string | null } | null
  primaryImage?: string | null
  allImages?: string[]
  activeBooking?: { id: string; bookingNumber: string; status: string; checkInDate?: string; checkOutDate: string; guest: { firstName: string; lastName: string } } | null
}

interface ZoneGroup {
  zone: { id: string; name: string; imageUrl?: string | null }
  rooms: RoomData[]
}

// ── Game-style Action Menu ────────────────────────────────
function ActionMenuPortal({ room, onClose, onAction }: {
  room: RoomData
  onClose: () => void
  onAction: (room: RoomData, action: string) => void
}) {
  const [hoveredIdx, setHoveredIdx] = useState(0)
  const cfg = ROOM_STATUS[room.dateStatus] || ROOM_STATUS.clean
  const isOOO = OOO_STATUSES.includes(room.dateStatus)

  const actions = [
    ...(room.dateStatus === 'clean' || room.dateStatus === 'inspected' ? [
      { id: 'book', label: 'สร้างการจอง' },
    ] : []),
    ...(room.dateStatus === 'reserved' ? [
      { id: 'checkin', label: 'CHECK-IN' },
    ] : []),
    ...(room.dateStatus === 'occupied' ? [
      { id: 'checkout', label: 'CHECK-OUT' },
    ] : []),
    ...(room.activeBooking ? [
      { id: 'view', label: 'ดูการจอง' },
    ] : []),
    ...(!isOOO ? [
      { id: 'housekeeping', label: 'งานทำความสะอาด' },
      { id: 'ooo', label: 'ตั้ง Out of Order' },
    ] : [
      { id: 'clear-ooo', label: 'เคลียร์ OOO' },
    ]),
    { id: 'maintenance', label: 'แจ้งซ่อม' },
    { id: '__close', label: 'ยกเลิก' },
  ]
  const uniqueActions = actions.filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i)

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') setHoveredIdx(i => Math.min(i + 1, uniqueActions.length - 1))
      if (e.key === 'ArrowUp') setHoveredIdx(i => Math.max(i - 1, 0))
      if (e.key === 'Enter') {
        const act = uniqueActions[hoveredIdx]
        if (act.id === '__close') { onClose(); return }
        onClose(); onAction(room, act.id)
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hoveredIdx, uniqueActions, room, onClose, onAction])

  return createPortal(
    <>
      {/* Backdrop — blur ไม่ทึบ */}
      <motion.div
        className="fixed inset-0 z-[9998] bg-black/55 backdrop-blur-md"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Game menu */}
      <motion.div
        className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Room title — glitch style */}
        <div className="mb-10 text-center">
          <motion.div
            className="text-xs font-bold uppercase tracking-[0.4em] text-stone-600 mb-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
          >
            {room.roomType.name}
          </motion.div>
          <motion.h2
            className="text-4xl font-black uppercase tracking-widest text-white"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            ห้อง {room.roomNumber}
          </motion.h2>
          <motion.div
            className={cn('mt-2 text-sm font-bold uppercase tracking-widest', cfg.color)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
          >
            — {cfg.label} —
          </motion.div>
          {room.activeBooking && (
            <motion.div
              className="mt-1.5 text-xs text-stone-500 tracking-wider"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            >
              {room.activeBooking.guest.firstName} {room.activeBooking.guest.lastName}
            </motion.div>
          )}
          {room.isOverstay && room.activeBooking && (
            <motion.div
              className="mt-1.5 inline-block rounded-full bg-red-500/15 border border-red-400/40 px-3 py-1 text-xs font-bold text-red-400 tracking-wider"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}
            >
              เลยกำหนดเช็คเอาท์ • ครบกำหนด {formatDate(room.activeBooking.checkOutDate, 'dd/MM')}
            </motion.div>
          )}
        </div>

        {/* Menu items */}
        <div className="space-y-1">
          {uniqueActions.map((act, i) => {
            const isActive = hoveredIdx === i
            const isClose = act.id === '__close'
            return (
              <motion.button
                key={act.id}
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => {
                  if (act.id === '__close') { onClose(); return }
                  onClose(); onAction(room, act.id)
                }}
                className="flex w-full items-center gap-4 px-2 py-2.5 text-left group"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 + 0.15, duration: 0.2 }}
              >
                {/* Cursor arrow */}
                <motion.span
                  className="w-6 flex-shrink-0 text-center text-lg font-black"
                  animate={{
                    opacity: isActive ? 1 : 0,
                    color: isClose ? '#6b7280' : '#fbbf24',
                  }}
                  transition={{ duration: 0.1 }}
                >
                  ▶
                </motion.span>

                {/* Label */}
                <motion.span
                  className={cn(
                    'text-lg font-bold uppercase tracking-widest transition-all duration-100',
                    isClose
                      ? isActive ? 'text-stone-400' : 'text-stone-700'
                      : isActive ? 'text-white' : 'text-stone-600'
                  )}
                  animate={isActive && !isClose ? {
                    textShadow: ['0 0 0px transparent', '0 0 12px rgba(255,220,100,0.6)', '0 0 8px rgba(255,220,100,0.4)'],
                  } : { textShadow: '0 0 0px transparent' }}
                  transition={{ duration: 0.2 }}
                >
                  {act.label}
                </motion.span>
              </motion.button>
            )
          })}
        </div>

        {/* Footer hint */}
        <motion.div
          className="mt-8 text-center text-xs text-stone-800 tracking-widest uppercase"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        >
          ↑ ↓ ARROW  •  ENTER SELECT  •  ESC CANCEL
        </motion.div>
      </motion.div>
    </>,
    document.body
  )
}

// ── Room Card with Slideshow ─────────────────────────────
function RoomCard({ room, onAction }: { room: RoomData; onAction: (room: RoomData, action: string) => void }) {
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; width: number } | null>(null)
  const [imgIndex, setImgIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const slideTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const cfg = ROOM_STATUS[room.dateStatus] || ROOM_STATUS.clean
  const isOOO = OOO_STATUSES.includes(room.dateStatus)
  const images = room.allImages?.length ? room.allImages : (room.primaryImage ? [room.primaryImage] : [])
  const hasMultiple = images.length > 1

  // Auto-slide on hover
  useEffect(() => {
    if (isHovered && hasMultiple) {
      slideTimer.current = setInterval(() => {
        setImgIndex(i => (i + 1) % images.length)
      }, 1800)
    } else {
      if (slideTimer.current) clearInterval(slideTimer.current)
      if (!isHovered) setImgIndex(0)
    }
    return () => { if (slideTimer.current) clearInterval(slideTimer.current) }
  }, [isHovered, hasMultiple, images.length])

  const handleClick = () => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMenuAnchor({ x: rect.left, y: rect.bottom, width: rect.width })
  }

  return (
    <>
      <motion.div
        ref={cardRef}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'relative overflow-hidden rounded-2xl border-2 cursor-pointer select-none',
          cfg.border, cfg.glow,
          isOOO && 'grayscale opacity-55',
          menuAnchor ? 'scale-[1.02] ring-2 ring-white/20' : 'hover:scale-[1.02]',
          'transition-transform duration-200'
        )}
        style={{ aspectRatio: '4/3' }}
        whileTap={{ scale: 0.97 }}
      >
        {/* Slideshow images */}
        {images.length > 0 ? (
          <AnimatePresence>
            <motion.img
              key={imgIndex}
              src={images[imgIndex]}
              alt={room.roomNumber}
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          </AnimatePresence>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-900" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

        {/* OOO icon */}
        {isOOO && (
          <div className="absolute inset-0 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-stone-500/70" />
          </div>
        )}

        {/* Status badges */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', cfg.badgeSolid)}>
            {cfg.label}
          </span>
          {room.isOverstay && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(220,38,38,0.6)] animate-pulse">
              เลยกำหนด
            </span>
          )}
        </div>

        {/* Image dots indicator */}
        {hasMultiple && isHovered && (
          <div className="absolute top-2 left-2 flex gap-1">
            {images.map((_, i) => (
              <div key={i} className={cn('h-1.5 rounded-full transition-all duration-300', i === imgIndex ? 'w-3 bg-white' : 'w-1.5 bg-white/40')} />
            ))}
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="text-sm font-bold text-white leading-tight">{room.roomNumber}</div>
          {room.activeBooking && (
            <div className="text-xs text-white/75 mt-0.5 truncate">
              {room.activeBooking.guest.firstName} {room.activeBooking.guest.lastName}
              <span className={cn('ml-1', room.isOverstay ? 'text-red-300 font-semibold' : 'text-white/45')}>→ {formatDate(room.activeBooking.checkOutDate, 'dd/MM')}</span>
            </div>
          )}
          <div className="text-xs text-white/40 mt-0.5">{room.roomType.name}</div>
        </div>
      </motion.div>

      <AnimatePresence>
        {menuAnchor && (
          <ActionMenuPortal
            room={room}
            onClose={() => setMenuAnchor(null)}
            onAction={onAction}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Main Page ────────────────────────────────────────────
export default function RoomMapPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [zoneFilter, setZoneFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [prefillRoomId, setPrefillRoomId] = useState<string | undefined>()
  const [prefillRoomTypeId, setPrefillRoomTypeId] = useState<string | undefined>()
  const [oooDialog, setOooDialog] = useState<{ roomId: string; roomNumber: string } | null>(null)
  const [oooReason, setOooReason] = useState('')
  const [hkConfirm, setHkConfirm] = useState<{ roomId: string; roomNumber: string } | null>(null)

  // react-query so this view participates in cross-page cache invalidation
  // (bookings / room-grid / dashboard share the same data). Background refetch
  // every 3 min keeps previous data on screen — no loading flash.
  const { data: mapData = [], isLoading, isError } = useQuery<ZoneGroup[]>({
    queryKey: ['room-map', selectedDate],
    queryFn: () => roomsApi.map(selectedDate).then(r => r.data ?? []),
    refetchInterval: 3 * 60_000,
  })

  useEffect(() => {
    if (isError) toast.error('โหลดข้อมูลห้องไม่สำเร็จ')
  }, [isError])

  // Any room/booking change here also affects the grid, bookings list, dashboard,
  // and (when creating a cleaning task / setting OOO) the housekeeping views.
  const invalidateRelated = () => {
    qc.invalidateQueries({ queryKey: ['room-map'] })
    qc.invalidateQueries({ queryKey: ['room-grid'] })
    qc.invalidateQueries({ queryKey: ['bookings'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['occupancy-forecast'] })
    qc.invalidateQueries({ queryKey: ['housekeeping'] })
    qc.invalidateQueries({ queryKey: ['hk-pending'] })
  }

  const { data: zones } = useQuery({ queryKey: ['zones-flat'], queryFn: () => zonesApi.flat().then(r => r.data) })
  const { data: roomTypes } = useQuery({ queryKey: ['room-types'], queryFn: () => roomTypesApi.list().then(r => r.data) })

  const setOooMutation = useMutation({
    mutationFn: ({ roomId, reason }: { roomId: string; reason: string }) => roomsApi.updateStatus(roomId, 'out_of_order', reason),
    onSuccess: () => { invalidateRelated(); setOooDialog(null); setOooReason(''); toast.success('ตั้ง OOO แล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const clearOooMutation = useMutation({
    mutationFn: (roomId: string) => roomsApi.updateStatus(roomId, 'clean', 'แก้ไขแล้ว'),
    onSuccess: () => { invalidateRelated(); toast.success('ห้องพร้อมแล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const createHkMutation = useMutation({
    mutationFn: ({ roomId }: { roomId: string }) => housekeepingApi.create({ roomId, taskType: 'stayover_cleaning' }),
    onSuccess: () => { invalidateRelated(); setHkConfirm(null); toast.success('สร้างงานทำความสะอาดแล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const handleAction = (room: RoomData, action: string) => {
    switch (action) {
      case 'book':
        setPrefillRoomId(room.id); setPrefillRoomTypeId(room.roomType.id); setCreateOpen(true); break
      case 'checkin': case 'checkout': case 'view':
        if (room.activeBooking) router.push(`/bookings/${room.activeBooking.id}`); break
      case 'housekeeping':
        setHkConfirm({ roomId: room.id, roomNumber: room.roomNumber }); break
      case 'ooo':
        setOooDialog({ roomId: room.id, roomNumber: room.roomNumber }); break
      case 'clear-ooo':
        clearOooMutation.mutate(room.id); break
      case 'maintenance':
        router.push('/maintenance'); break
    }
  }

  const navigateDate = (delta: number) => {
    setSelectedDate(prev => format(addDays(parseISO(prev), delta), 'yyyy-MM-dd'))
  }

  const toggleStatus = (s: string) => setStatusFilters(prev =>
    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
  )

  const clearAllFilters = () => { setZoneFilter(''); setTypeFilter(''); setStatusFilters([]) }
  const activeFilterCount = (zoneFilter ? 1 : 0) + (typeFilter ? 1 : 0) + statusFilters.length

  const filteredGroups = mapData
    .map(g => ({
      ...g,
      rooms: g.rooms.filter(r => {
        if (zoneFilter && r.zone?.id !== zoneFilter) return false
        if (typeFilter && r.roomType.id !== typeFilter) return false
        if (statusFilters.length > 0 && !statusFilters.includes(r.dateStatus)) return false
        return true
      }),
    }))
    .filter(g => g.rooms.length > 0)

  const totalRooms = filteredGroups.reduce((s, g) => s + g.rooms.length, 0)
  const availableRooms = filteredGroups.reduce((s, g) => s + g.rooms.filter(r => ['clean', 'inspected'].includes(r.dateStatus)).length, 0)

  const currentDateObj = parseISO(selectedDate)

  const dateLabel = (() => {
    if (isToday(currentDateObj)) return 'วันนี้'
    if (isTomorrow(currentDateObj)) return 'พรุ่งนี้'
    return format(currentDateObj, 'EEEE d MMM', { locale: th })
  })()

  return (
    <AppShell title="ผังห้อง" subtitle={`${dateLabel} — ว่าง ${availableRooms}/${totalRooms} ห้อง`}>
      <div className="space-y-5">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl border border-white/15 bg-white/[0.06] overflow-hidden">
            <button onClick={() => navigateDate(-1)} className="px-2.5 py-2 hover:bg-white/[0.06] transition-colors">
              <ChevronLeft className="h-4 w-4 text-stone-400" />
            </button>
            <button onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
              className={cn('px-3 py-2 text-xs font-medium transition-colors border-x border-white/10', isToday(currentDateObj) ? 'text-amber-300' : 'text-stone-400 hover:text-amber-300')}>
              วันนี้
            </button>
            <button onClick={() => setSelectedDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
              className={cn('px-3 py-2 text-xs font-medium transition-colors border-x border-white/10', isTomorrow(currentDateObj) ? 'text-amber-300' : 'text-stone-400 hover:text-amber-300')}>
              พรุ่งนี้
            </button>
            <button onClick={() => navigateDate(1)} className="px-2.5 py-2 hover:bg-white/[0.06] transition-colors">
              <ChevronRight className="h-4 w-4 text-stone-400" />
            </button>
          </div>

          <input type="date" value={selectedDate}
            onChange={e => { if (e.target.value) setSelectedDate(e.target.value) }}
            className="h-9 rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-stone-300 focus:border-amber-300/40 focus:outline-none" />

          <div className="ml-auto">
            <Button size="sm" onClick={() => { setPrefillRoomId(undefined); setPrefillRoomTypeId(undefined); setCreateOpen(true) }}>
              <Plus className="h-4 w-4" /> สร้างการจอง
            </Button>
          </div>
        </div>

        {/* ── Collapsible Filter Panel ── */}
        <RoomFilterPanel
          open={filterOpen}
          onToggleOpen={() => setFilterOpen(!filterOpen)}
          zones={(zones as Array<{ id: string; name: string }>) || []}
          roomTypes={(roomTypes as Array<{ id: string; name: string }>) || []}
          zoneFilter={zoneFilter}
          onZoneFilter={setZoneFilter}
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          statusOptions={STATUS_CHIPS}
          statusFilters={statusFilters}
          onToggleStatus={toggleStatus}
          activeCount={activeFilterCount}
          onClearAll={clearAllFilters}
        />

        {/* Zone sections */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-3xl" />)}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 rounded-3xl border border-white/[0.08] bg-white/[0.03]">
            <BedDouble className="h-14 w-14 text-stone-600" />
            <div className="text-center">
              <p className="text-base font-semibold text-stone-300">
                {mapData.length === 0 ? 'ยังไม่มีห้องพักในระบบ' : 'ไม่พบห้องพักตามเงื่อนไข'}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {mapData.length === 0
                  ? 'กรุณาเพิ่มห้องพักใน ตั้งค่า → ห้องพัก'
                  : 'ลองเปลี่ยนตัวกรองหรือเลือกวันที่อื่น'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredGroups.map((group, gi) => {
              const availCount = group.rooms.filter(r => ['clean', 'inspected'].includes(r.dateStatus)).length
              return (
                <motion.div key={group.zone.id}
                  className="relative rounded-3xl border border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.50)] overflow-hidden"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.08, duration: 0.35 }}
                >
                  {/* Full-card zone background */}
                  {group.zone.imageUrl ? (
                    <img
                      src={group.zone.imageUrl}
                      alt={group.zone.name}
                      className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-950" />
                  )}
                  {/* Dark overlay — stronger at bottom so rooms are readable */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/85" />
                  {/* Backdrop blur layer */}
                  <div className="absolute inset-0 backdrop-blur-[1px]" />

                  {/* Content (relative so it sits above bg) */}
                  <div className="relative">
                    {/* Zone header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <BedDouble className="h-4 w-4 text-amber-400 flex-shrink-0" />
                        <span className="text-sm font-bold text-white tracking-wide">{group.zone.name}</span>
                        <span className="text-xs text-white/50">{group.rooms.length} ห้อง</span>
                      </div>
                      <div className={cn('text-xs font-semibold px-2.5 py-1 rounded-lg border backdrop-blur-sm', availCount > 0 ? 'text-emerald-300 bg-emerald-500/15 border-emerald-400/25' : 'text-rose-300 bg-rose-500/15 border-rose-400/25')}>
                        {availCount}/{group.rooms.length} ว่าง
                      </div>
                    </div>

                    {/* Rooms grid */}
                    <div className="p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {group.rooms.map((room, ri) => (
                          <motion.div key={room.id}
                            initial={{ opacity: 0, scale: 0.93 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: gi * 0.04 + ri * 0.04, duration: 0.22 }}
                          >
                            <RoomCard room={room} onAction={handleAction} />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* OOO Dialog */}
      <PmsDialog open={!!oooDialog} onClose={() => setOooDialog(null)} title="ตั้งห้อง Out of Order"
        description={`ห้อง ${oooDialog?.roomNumber} จะถูกนำออกจากการขาย`} size="sm">
        <div className="space-y-4">
          <Input label="เหตุผล *" value={oooReason} onChange={e => setOooReason(e.target.value)} placeholder="แอร์เสีย, น้ำรั่ว, รอซ่อม..." />
          <Button onClick={() => oooDialog && setOooMutation.mutate({ roomId: oooDialog.roomId, reason: oooReason })}
            loading={setOooMutation.isPending} variant="destructive" className="w-full" disabled={!oooReason.trim()}>
            <AlertTriangle className="h-4 w-4" /> ยืนยัน OOO
          </Button>
        </div>
      </PmsDialog>

      {/* Housekeeping Confirm */}
      <ConfirmDialog open={!!hkConfirm} onClose={() => setHkConfirm(null)}
        onConfirm={() => hkConfirm && createHkMutation.mutate({ roomId: hkConfirm.roomId })}
        title="สร้างงานทำความสะอาด"
        description={`ห้อง ${hkConfirm?.roomNumber} — สร้าง Stayover Cleaning task`}
        confirmLabel="✓ สร้างงาน" variant="success" loading={createHkMutation.isPending}
      />

      {/* Create Booking */}
      <CreateBookingDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); invalidateRelated() }}
        prefillRoomId={prefillRoomId} prefillRoomTypeId={prefillRoomTypeId}
      />
    </AppShell>
  )
}
