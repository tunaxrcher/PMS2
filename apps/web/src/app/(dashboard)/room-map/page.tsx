'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { format, addDays, isToday, isTomorrow } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, RefreshCw, Plus, DoorOpen, DoorClosed,
  Sparkles, Wrench, AlertTriangle, BedDouble, X, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { roomsApi, zonesApi, roomTypesApi, housekeepingApi } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { CreateBookingDialog } from '@/components/bookings/create-booking-dialog'

// ── Status config ──────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; border: string; badge: string; glow: string; dim: boolean }> = {
  clean:          { label: 'ว่าง',              border: 'border-emerald-400/70', badge: 'bg-emerald-500 text-white',   glow: 'shadow-[0_0_20px_rgba(52,211,153,0.35)]', dim: false },
  dirty:          { label: 'รอทำความสะอาด',    border: 'border-amber-400/70',   badge: 'bg-amber-500 text-white',     glow: 'shadow-[0_0_20px_rgba(251,191,36,0.30)]', dim: false },
  occupied:       { label: 'มีผู้เข้าพัก',      border: 'border-rose-400/70',    badge: 'bg-rose-500 text-white',      glow: 'shadow-[0_0_20px_rgba(248,113,113,0.35)]', dim: false },
  reserved:       { label: 'จองแล้ว',           border: 'border-sky-400/70',     badge: 'bg-sky-500 text-white',       glow: 'shadow-[0_0_20px_rgba(56,189,248,0.30)]', dim: false },
  cleaning:       { label: 'กำลังทำ',          border: 'border-sky-300/50',     badge: 'bg-sky-400/90 text-white',    glow: '', dim: false },
  out_of_order:   { label: 'ห้องเสีย',          border: 'border-stone-600/50',   badge: 'bg-stone-700 text-stone-400', glow: '', dim: true  },
  out_of_service: { label: 'ปิดบริการ',         border: 'border-stone-500/40',   badge: 'bg-stone-600 text-stone-500', glow: '', dim: true  },
  inspected:      { label: 'ตรวจแล้ว',          border: 'border-teal-400/60',    badge: 'bg-teal-500 text-white',      glow: '', dim: false },
}

interface RoomData {
  id: string; roomNumber: string; roomName?: string | null; currentStatus: string; dateStatus: string
  roomType: { id: string; name: string; imageUrl?: string | null; baseRate: number | string }
  zone?: { id: string; name: string; imageUrl?: string | null } | null
  primaryImage?: string | null
  activeBooking?: { id: string; bookingNumber: string; status: string; checkOutDate: string; guest: { firstName: string; lastName: string } } | null
}

interface ZoneGroup {
  zone: { id: string; name: string; imageUrl?: string | null }
  rooms: RoomData[]
}

// ── Action Menu Portal ────────────────────────────────────
function ActionMenuPortal({ room, anchor, onClose, onAction }: {
  room: RoomData
  anchor: { x: number; y: number; width: number }
  onClose: () => void
  onAction: (room: RoomData, action: string) => void
}) {
  const isOOO = ['out_of_order', 'out_of_service'].includes(room.dateStatus)

  const actions = [
    ...(room.dateStatus === 'clean' || room.dateStatus === 'inspected' ? [
      { id: 'book', icon: Plus, label: 'สร้างการจอง', color: 'text-amber-300' },
    ] : []),
    ...(room.dateStatus === 'reserved' ? [
      { id: 'checkin', icon: DoorOpen, label: 'Check-in', color: 'text-emerald-300' },
    ] : []),
    ...(room.dateStatus === 'occupied' ? [
      { id: 'checkout', icon: DoorClosed, label: 'Check-out', color: 'text-amber-300' },
    ] : []),
    ...(room.activeBooking ? [
      { id: 'view', icon: BedDouble, label: 'ดูการจอง', color: 'text-sky-300' },
    ] : []),
    ...(!isOOO ? [
      { id: 'housekeeping', icon: Sparkles, label: 'สร้างงานทำความสะอาด', color: 'text-violet-300' },
      { id: 'ooo', icon: AlertTriangle, label: 'ตั้ง Out of Order', color: 'text-rose-300' },
    ] : [
      { id: 'clear-ooo', icon: CheckCircle2, label: 'เคลียร์ OOO', color: 'text-emerald-300' },
    ]),
    { id: 'maintenance', icon: Wrench, label: 'แจ้งซ่อม', color: 'text-orange-300' },
  ]
  const uniqueActions = actions.filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i)

  // Position: below the card, left-aligned, clamp to viewport
  const menuWidth = 208
  let left = anchor.x
  if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8
  const top = anchor.y + 6

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      {/* Menu */}
      <motion.div
        className="fixed z-[9999] w-52 rounded-2xl border border-white/15 bg-black/85 backdrop-blur-2xl p-1.5 shadow-2xl"
        style={{ left, top }}
        initial={{ opacity: 0, scale: 0.93, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: -6 }}
        transition={{ duration: 0.15 }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-1">
          <span className="text-xs font-semibold text-stone-200">ห้อง {room.roomNumber}</span>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-300 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {uniqueActions.map((act) => (
          <button key={act.id}
            onClick={() => { onClose(); onAction(room, act.id) }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-stone-300 hover:bg-white/[0.08] hover:text-stone-100 transition-colors text-left"
          >
            <act.icon className={cn('h-3.5 w-3.5 flex-shrink-0', act.color)} />
            {act.label}
          </button>
        ))}
      </motion.div>
    </>,
    document.body
  )
}

// ── Room Card ────────────────────────────────────────────
function RoomCard({ room, onAction }: { room: RoomData; onAction: (room: RoomData, action: string) => void }) {
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; width: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const cfg = STATUS_CFG[room.dateStatus] || STATUS_CFG.clean
  const isOOO = ['out_of_order', 'out_of_service'].includes(room.dateStatus)
  const bgImg = room.primaryImage || room.roomType.imageUrl

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
        className={cn(
          'relative overflow-hidden rounded-2xl border-2 cursor-pointer transition-all duration-200 select-none',
          cfg.border, cfg.glow,
          isOOO && 'grayscale opacity-55',
          'hover:scale-[1.02]',
          menuAnchor && 'scale-[1.02] ring-2 ring-white/20'
        )}
        style={{ aspectRatio: '4/3' }}
        whileTap={{ scale: 0.97 }}
      >
        {/* Background */}
        {bgImg ? (
          <img src={bgImg} alt={room.roomNumber} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-900" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* OOO icon */}
        {isOOO && (
          <div className="absolute inset-0 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-stone-500/70" />
          </div>
        )}

        {/* Status badge */}
        <span className={cn('absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold', cfg.badge)}>
          {cfg.label}
        </span>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="text-sm font-bold text-white leading-tight">{room.roomNumber}</div>
          {room.activeBooking && (
            <div className="text-[10px] text-white/75 mt-0.5 truncate">
              {room.activeBooking.guest.firstName} {room.activeBooking.guest.lastName}
              <span className="text-white/45 ml-1">→ {formatDate(room.activeBooking.checkOutDate, 'dd/MM')}</span>
            </div>
          )}
          <div className="text-[9px] text-white/40 mt-0.5">{room.roomType.name}</div>
        </div>
      </motion.div>

      <AnimatePresence>
        {menuAnchor && (
          <ActionMenuPortal
            room={room}
            anchor={menuAnchor}
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [mapData, setMapData] = useState<ZoneGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [zoneFilter, setZoneFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [prefillRoomId, setPrefillRoomId] = useState<string | undefined>()
  const [prefillRoomTypeId, setPrefillRoomTypeId] = useState<string | undefined>()
  const [oooDialog, setOooDialog] = useState<{ roomId: string; roomNumber: string } | null>(null)
  const [oooReason, setOooReason] = useState('')
  const [hkConfirm, setHkConfirm] = useState<{ roomId: string; roomNumber: string } | null>(null)

  // Direct fetch — avoids TanStack Query caching issues with gcTime
  const fetchMap = useCallback(async (date: string) => {
    setIsLoading(true)
    try {
      const res = await roomsApi.map(date)
      setMapData(res.data || [])
    } catch { /* ignore */ } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMap(selectedDate)
  }, [selectedDate, fetchMap])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchMap(selectedDate), 30_000)
    return () => clearInterval(interval)
  }, [selectedDate, fetchMap])

  const { data: zones } = useQuery({ queryKey: ['zones-flat'], queryFn: () => zonesApi.flat().then(r => r.data) })
  const { data: roomTypes } = useQuery({ queryKey: ['room-types'], queryFn: () => roomTypesApi.list().then(r => r.data) })

  const setOooMutation = useMutation({
    mutationFn: ({ roomId, reason }: { roomId: string; reason: string }) => roomsApi.updateStatus(roomId, 'out_of_order', reason),
    onSuccess: () => { fetchMap(selectedDate); setOooDialog(null); setOooReason(''); toast.success('ตั้ง OOO แล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const clearOooMutation = useMutation({
    mutationFn: (roomId: string) => roomsApi.updateStatus(roomId, 'clean', 'แก้ไขแล้ว'),
    onSuccess: () => { fetchMap(selectedDate); toast.success('ห้องพร้อมแล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const createHkMutation = useMutation({
    mutationFn: ({ roomId }: { roomId: string }) => housekeepingApi.create({ roomId, taskType: 'stayover_cleaning' }),
    onSuccess: () => { fetchMap(selectedDate); setHkConfirm(null); toast.success('สร้างงานทำความสะอาดแล้ว') },
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
    const parts = selectedDate.split('-').map(Number)
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    d.setDate(d.getDate() + delta)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setSelectedDate(`${y}-${m}-${day}`)
  }

  const filteredGroups = mapData
    .map(g => ({
      ...g,
      rooms: g.rooms.filter(r => {
        if (zoneFilter && r.zone?.id !== zoneFilter) return false
        if (typeFilter && r.roomType.id !== typeFilter) return false
        if (statusFilter && r.dateStatus !== statusFilter) return false
        return true
      }),
    }))
    .filter(g => g.rooms.length > 0)

  const totalRooms = filteredGroups.reduce((s, g) => s + g.rooms.length, 0)
  const availableRooms = filteredGroups.reduce((s, g) => s + g.rooms.filter(r => ['clean', 'inspected'].includes(r.dateStatus)).length, 0)

  const currentDateObj = (() => {
    const parts = selectedDate.split('-').map(Number)
    return new Date(parts[0], parts[1] - 1, parts[2])
  })()

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
            <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
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

          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="ทุกโซน" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">ทุกโซน</SelectItem>
              {(zones as Array<{ id: string; name: string }> || []).map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="ทุกประเภท" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">ทุกประเภทห้อง</SelectItem>
              {(roomTypes as Array<{ id: string; name: string }> || []).map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="ทุกสถานะ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">ทุกสถานะ</SelectItem>
              {Object.entries(STATUS_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => fetchMap(selectedDate)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-stone-400 hover:text-stone-100 transition-colors">
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
            <Button size="sm" onClick={() => { setPrefillRoomId(undefined); setPrefillRoomTypeId(undefined); setCreateOpen(true) }}>
              <Plus className="h-4 w-4" /> สร้างการจอง
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {Object.entries(STATUS_CFG).slice(0, 6).map(([k, v]) => (
            <button key={k} onClick={() => setStatusFilter(statusFilter === k ? '' : k)}
              className={cn('flex items-center gap-1.5 text-xs transition-colors', statusFilter === k ? 'text-stone-200 font-medium' : 'text-stone-600 hover:text-stone-400')}>
              <span className={cn('h-2.5 w-2.5 rounded-full border-2 flex-shrink-0', v.border)} />
              {v.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-stone-700">คลิกที่ห้องเพื่อดู action</span>
        </div>

        {/* Zone sections */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-3xl" />)}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-stone-500">
            <BedDouble className="h-12 w-12 opacity-30" />
            <p className="text-sm">ไม่พบห้องพักตามเงื่อนไข</p>
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
        onSuccess={() => { setCreateOpen(false); fetchMap(selectedDate) }}
        prefillRoomId={prefillRoomId} prefillRoomTypeId={prefillRoomTypeId}
      />
    </AppShell>
  )
}
