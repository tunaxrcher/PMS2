'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { addDays, format, eachDayOfInterval, parseISO, differenceInDays, isSameDay } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  useDraggable, useDroppable, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  ChevronLeft, ChevronRight, RefreshCw, Plus, AlertTriangle,
  BedDouble, Filter, Layers, MapPin
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { roomsApi, bookingsApi, zonesApi, roomTypesApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CreateBookingDialog } from '@/components/bookings/create-booking-dialog'

const CELL_W = 52
const ROW_H = 56
const ROOM_COL_W = 180

// Thai status labels
const ROOM_STATUS_TH: Record<string, { label: string; bg: string; dot: string }> = {
  clean:         { label: 'สะอาด',           bg: 'bg-emerald-400/10', dot: 'bg-emerald-400' },
  dirty:         { label: 'รอทำความสะอาด',   bg: 'bg-amber-400/10',   dot: 'bg-amber-400' },
  occupied:      { label: 'มีผู้เข้าพัก',    bg: 'bg-rose-400/10',    dot: 'bg-rose-400' },
  cleaning:      { label: 'กำลังทำ',         bg: 'bg-sky-400/10',     dot: 'bg-sky-400' },
  out_of_order:  { label: 'ห้องเสีย',        bg: 'bg-stone-500/15',   dot: 'bg-stone-500' },
  out_of_service:{ label: 'ปิดบริการ',       bg: 'bg-stone-400/10',   dot: 'bg-stone-400' },
  inspected:     { label: 'ตรวจแล้ว',        bg: 'bg-teal-400/10',    dot: 'bg-teal-400' },
}

const BOOKING_BLOCK_COLORS: Record<string, string> = {
  confirmed:    'bg-sky-400/25 border-sky-300/40 text-sky-50 hover:bg-sky-400/35',
  checked_in:   'bg-rose-400/25 border-rose-300/40 text-rose-50 hover:bg-rose-400/35',
  pending:      'bg-amber-400/25 border-amber-300/40 text-amber-50 hover:bg-amber-400/35',
  checked_out:  'bg-stone-400/15 border-stone-300/20 text-stone-400',
}

interface BookingRoom {
  id: string; bookingId: string; checkInDate: string; checkOutDate: string; status: string; rate: number
  booking: { id: string; bookingNumber: string; status: string; guest: { firstName: string; lastName: string }; adults: number }
}

interface Room {
  id: string; roomNumber: string; roomName?: string | null; currentStatus: string
  roomType: { id: string; name: string; imageUrl?: string | null }
  zone?: { id: string; name: string; imageUrl?: string | null } | null
  bookingRooms: BookingRoom[]
}

interface UnassignedBooking {
  id: string; bookingId: string; checkInDate: string; checkOutDate: string; status: string
  roomType: { id: string; name: string }
  booking: { id: string; bookingNumber: string; status: string; guest: { firstName: string; lastName: string } }
}

// Draggable booking block
function BookingBlock({ br, startOffset, width, colorClass, onClick }: {
  br: BookingRoom; startOffset: number; width: number; colorClass: string; onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `booking-${br.id}`,
    data: { bookingRoomId: br.id, bookingId: br.bookingId }
  })

  const nights = differenceInDays(parseISO(br.checkOutDate), parseISO(br.checkInDate))

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'absolute inset-y-1.5 rounded-xl border text-xs flex items-center px-2.5 overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none z-10',
        colorClass,
        isDragging && 'opacity-30 scale-95'
      )}
      style={{ left: startOffset * CELL_W + 3, width: width * CELL_W - 6, touchAction: 'none' }}
      title={`${br.booking?.guest?.firstName} ${br.booking?.guest?.lastName}`}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="truncate font-medium text-[11px]">
          {br.booking?.guest?.firstName} {br.booking?.guest?.lastName?.[0]}.
        </span>
        {width > 2 && <span className="flex-shrink-0 text-[10px] opacity-70">{nights}ค</span>}
      </div>
    </div>
  )
}

// Droppable cell
function DropCell({ roomId, dateIdx, isOOO, onClick }: {
  roomId: string; dateIdx: number; isOOO: boolean; onClick: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${roomId}-${dateIdx}`, data: { roomId } })
  return (
    <div ref={setNodeRef} style={{ width: CELL_W }} className={cn(
      'flex-shrink-0 h-full border-r border-white/5 transition-colors',
      !isOOO && 'cursor-pointer hover:bg-amber-400/[0.08]',
      isOver && !isOOO && 'bg-amber-400/20',
    )}
      onClick={() => !isOOO && onClick()} />
  )
}

export default function RoomGridPage() {
  const qc = useQueryClient()
  const today = new Date()
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [days] = useState(30)
  const [zoneFilter, setZoneFilter] = useState('')
  const [rtFilter, setRtFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [prefillDate, setPrefillDate] = useState<{ checkIn: string; checkOut: string } | undefined>()
  const [prefillRoomTypeId, setPrefillRoomTypeId] = useState<string | undefined>()
  const [prefillRoomId, setPrefillRoomId] = useState<string | undefined>()
  const [oooDialog, setOooDialog] = useState<{ roomId: string; roomNumber: string } | null>(null)
  const [oooReason, setOooReason] = useState('')
  const [activeDrag, setActiveDrag] = useState<{ guestName: string } | null>(null)

  const endDate = addDays(startDate, days - 1)
  const from = format(startDate, 'yyyy-MM-dd')
  const to = format(endDate, 'yyyy-MM-dd')
  const dateColumns = eachDayOfInterval({ start: startDate, end: endDate })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const { data: gridData, isLoading, refetch } = useQuery({
    queryKey: ['room-grid', from, to],
    queryFn: () => roomsApi.grid(from, to).then(r => r.data),
    refetchInterval: 15_000,
  })
  const rooms = (gridData as { rooms?: Room[]; unassignedBookings?: UnassignedBooking[] } | null)?.rooms
  const unassigned = (gridData as { rooms?: Room[]; unassignedBookings?: UnassignedBooking[] } | null)?.unassignedBookings || []

  const { data: zones } = useQuery({ queryKey: ['zones-flat'], queryFn: () => zonesApi.flat().then(r => r.data) })
  const { data: roomTypes } = useQuery({ queryKey: ['room-types'], queryFn: () => roomTypesApi.list().then(r => r.data) })

  const moveRoomMutation = useMutation({
    mutationFn: ({ bookingRoomId, newRoomId }: { bookingRoomId: string; newRoomId: string }) =>
      bookingsApi.moveRoom('any', { bookingRoomId, newRoomId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-grid'] }); toast.success('ย้ายห้องสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'ไม่สามารถย้ายห้องได้'),
  })

  const setOooMutation = useMutation({
    mutationFn: ({ roomId, reason }: { roomId: string; reason: string }) =>
      roomsApi.updateStatus(roomId, 'out_of_order', reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-grid'] }); qc.invalidateQueries({ queryKey: ['rooms'] }); setOooDialog(null); setOooReason(''); toast.success('ตั้งห้อง Out of Order แล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const clearOooMutation = useMutation({
    mutationFn: (roomId: string) => roomsApi.updateStatus(roomId, 'clean', 'แก้ไขแล้ว'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-grid'] }); toast.success('ห้องพร้อมใช้งานแล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const filteredRooms = (rooms || []).filter((r: Room) => {
    if (zoneFilter && r.zone?.id !== zoneFilter) return false
    if (rtFilter && r.roomType?.id !== rtFilter) return false
    if (statusFilter && r.currentStatus !== statusFilter) return false
    return true
  })

  // Group rooms by zone
  const groupedRooms = React.useMemo(() => {
    const groups: { zone: string; rooms: Room[] }[] = []
    const zoneMap = new Map<string, Room[]>()
    filteredRooms.forEach(r => {
      const key = r.zone?.name || 'ไม่ระบุโซน'
      if (!zoneMap.has(key)) zoneMap.set(key, [])
      zoneMap.get(key)!.push(r)
    })
    zoneMap.forEach((rooms, zone) => groups.push({ zone, rooms }))
    return groups
  }, [filteredRooms])

  const getStartOffset = (br: BookingRoom) => Math.max(0, differenceInDays(parseISO(br.checkInDate), startDate))
  const getWidth = (br: BookingRoom) => {
    const start = Math.max(0, differenceInDays(parseISO(br.checkInDate), startDate))
    const end = Math.min(days, differenceInDays(parseISO(br.checkOutDate), startDate))
    return Math.max(1, end - start)
  }

  // Selected room type image for background
  const selectedRtImage = rtFilter
    ? (roomTypes as Array<{ id: string; imageUrl?: string | null }> || []).find(rt => rt.id === rtFilter)?.imageUrl
    : null

  const handleDragStart = (e: DragStartEvent) => {
    const allRooms: Room[] = rooms || []
    const brid = (e.active.data.current as { bookingRoomId: string })?.bookingRoomId
    for (const room of allRooms) {
      const br = room.bookingRooms?.find(b => b.id === brid)
      if (br) { setActiveDrag({ guestName: `${br.booking?.guest?.firstName} ${br.booking?.guest?.lastName}` }); break }
    }
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null)
    const { active, over } = e
    if (!over) return
    const dragData = active.data.current as { bookingRoomId: string } | undefined
    const dropData = over.data.current as { roomId: string } | undefined
    if (!dragData || !dropData) return
    const allRooms: Room[] = rooms || []
    let currentRoomId = ''
    for (const room of allRooms) {
      if (room.bookingRooms?.find(b => b.id === dragData.bookingRoomId)) { currentRoomId = room.id; break }
    }
    if (dropData.roomId && dropData.roomId !== currentRoomId && dragData.bookingRoomId) {
      moveRoomMutation.mutate({ bookingRoomId: dragData.bookingRoomId, newRoomId: dropData.roomId })
    }
  }

  const prevMonth = () => setStartDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); n.setDate(1); return n })
  const nextMonth = () => setStartDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); n.setDate(1); return n })
  const goToday = () => { const d = new Date(); d.setDate(1); setStartDate(d) }

  const activeFilters = [zoneFilter, rtFilter, statusFilter].filter(Boolean).length

  return (
    <AppShell title="ปฏิทินห้องพัก" subtitle={`${format(startDate, 'MMMM yyyy', { locale: th })}`}>
      <div className="flex flex-col gap-4">
        {/* Navigation controls */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-white/15 bg-white/[0.06] overflow-hidden">
              <button onClick={prevMonth} className="px-2.5 py-2 hover:bg-white/[0.06] transition-colors">
                <ChevronLeft className="h-4 w-4 text-stone-400" />
              </button>
              <button onClick={goToday} className="px-3 py-2 text-xs font-medium text-stone-300 hover:text-amber-300 transition-colors border-x border-white/10">
                วันนี้
              </button>
              <button onClick={nextMonth} className="px-2.5 py-2 hover:bg-white/[0.06] transition-colors">
                <ChevronRight className="h-4 w-4 text-stone-400" />
              </button>
            </div>
            <span className="text-sm font-medium text-stone-300">{format(startDate, 'MMMM yyyy', { locale: th })}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-stone-400 hover:bg-white/[0.10] hover:text-stone-100 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <Button size="sm" onClick={() => { setPrefillDate(undefined); setPrefillRoomTypeId(undefined); setPrefillRoomId(undefined); setCreateOpen(true) }}>
              <Plus className="h-4 w-4" /> สร้างการจอง
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Legend */}
          <div className="flex items-center gap-3 mr-2">
            {Object.entries(ROOM_STATUS_TH).slice(0, 4).map(([key, val]) => (
              <button key={key} onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
                className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all border', statusFilter === key ? 'border-white/25 bg-white/[0.10] text-stone-200' : 'border-transparent text-stone-500 hover:text-stone-300')}>
                <span className={cn('h-2 w-2 rounded-full flex-shrink-0', val.dot)} />
                {val.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)}
              className={cn('flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-colors', showFilters || activeFilters > 0 ? 'border-amber-300/30 bg-amber-400/10 text-amber-300' : 'border-white/15 bg-white/[0.06] text-stone-400 hover:text-stone-100')}>
              <Filter className="h-3.5 w-3.5" />
              ตัวกรอง
              {activeFilters > 0 && <span className="rounded-full bg-amber-400 text-stone-900 text-[9px] font-bold px-1">{activeFilters}</span>}
            </button>
          </div>

          {/* Expanded filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div className="flex w-full items-center gap-2 flex-wrap"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <Select value={zoneFilter} onValueChange={setZoneFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="ทุกโซน" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ทุกโซน</SelectItem>
                    {(zones as Array<{ id: string; name: string }> || []).map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={rtFilter} onValueChange={setRtFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="ทุกประเภทห้อง" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ทุกประเภทห้อง</SelectItem>
                    {(roomTypes as Array<{ id: string; name: string }> || []).map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {activeFilters > 0 && (
                  <button onClick={() => { setZoneFilter(''); setRtFilter(''); setStatusFilter('') }}
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors">
                    ล้างตัวกรอง
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Grid */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="relative rounded-3xl border border-white/15 bg-black/30 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.45)] overflow-hidden">
            {/* Room type bg image */}
            {selectedRtImage && (
              <div className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none transition-all duration-700"
                style={{ backgroundImage: `url(${selectedRtImage})` }} />
            )}

            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              <div style={{ minWidth: ROOM_COL_W + CELL_W * days }}>
                {/* Date header */}
                <div className="sticky top-0 z-20 flex border-b border-white/10 bg-black/50 backdrop-blur-xl">
                  <div style={{ width: ROOM_COL_W, minWidth: ROOM_COL_W }}
                    className="flex-shrink-0 border-r border-white/10 px-4 py-3 flex items-center gap-2">
                    <BedDouble className="h-3.5 w-3.5 text-stone-600" />
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">ห้อง</span>
                    <span className="ml-auto text-[10px] text-stone-700">{filteredRooms.length} ห้อง</span>
                  </div>
                  {dateColumns.map(date => {
                    const isToday = isSameDay(date, today)
                    const isWeekend = [0, 6].includes(date.getDay())
                    return (
                      <div key={date.toISOString()} style={{ width: CELL_W, minWidth: CELL_W }}
                        className={cn('flex-shrink-0 border-r border-white/[0.06] px-1 py-2 text-center', isToday && 'bg-amber-400/15', isWeekend && !isToday && 'bg-white/[0.02]')}>
                        <div className={cn('text-[9px] font-medium leading-none mb-0.5', isToday ? 'text-amber-400' : 'text-stone-600')}>
                          {format(date, 'EEE', { locale: th })}
                        </div>
                        <div className={cn('text-xs font-bold leading-none', isToday ? 'text-amber-300' : isWeekend ? 'text-stone-400' : 'text-stone-500')}>
                          {format(date, 'd')}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Unassigned bookings zone */}
                {unassigned.length > 0 && (
                  <div className="border-b border-amber-300/20 bg-amber-400/[0.04]">
                    <div className="flex border-b border-amber-300/10" style={{ minWidth: ROOM_COL_W + CELL_W * days }}>
                      <div style={{ width: ROOM_COL_W, minWidth: ROOM_COL_W }}
                        className="flex-shrink-0 border-r border-amber-300/15 px-4 py-2 flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">⏳ รอกำหนดห้อง</span>
                        <span className="text-[9px] text-amber-400/60 rounded-full bg-amber-400/15 px-1.5">{unassigned.length}</span>
                      </div>
                      <div className="flex-1 relative" style={{ height: 36 }}>
                        {unassigned.map((u: UnassignedBooking) => {
                          const offset = Math.max(0, differenceInDays(parseISO(u.checkInDate), startDate))
                          const width = Math.max(1, Math.min(days, differenceInDays(parseISO(u.checkOutDate), startDate)) - offset)
                          if (offset >= days || width <= 0) return null
                          return (
                            <div key={u.id}
                              className="absolute inset-y-1.5 rounded-lg border border-dashed border-amber-300/40 bg-amber-400/10 text-amber-200 text-[10px] flex items-center px-2 cursor-pointer hover:bg-amber-400/20 transition-colors"
                              style={{ left: offset * CELL_W + 3, width: width * CELL_W - 6 }}
                              onClick={() => window.location.href = `/bookings/${u.bookingId}`}
                              title={`${u.booking.guest.firstName} ${u.booking.guest.lastName} — ${u.roomType.name} (รอกำหนดห้อง)`}
                            >
                              <span className="truncate">{u.booking.guest.firstName} {u.booking.guest.lastName?.[0]}. — {u.roomType.name}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rows grouped by zone */}
                {isLoading ? (
                  <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : filteredRooms.length === 0 ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <BedDouble className="h-10 w-10 text-stone-700 mx-auto mb-3" />
                      <p className="text-stone-500 text-sm">ไม่มีห้องพักตามเงื่อนไข</p>
                    </div>
                  </div>
                ) : (
                  groupedRooms.map(group => (
                    <React.Fragment key={group.zone}>
                      {/* Zone header row */}
                      <div className="flex border-b border-white/[0.04] bg-white/[0.02]" style={{ minWidth: ROOM_COL_W + CELL_W * days }}>
                        <div style={{ width: ROOM_COL_W, minWidth: ROOM_COL_W }}
                          className="flex-shrink-0 border-r border-white/10 px-4 py-1.5 flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-amber-400/70" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/70">{group.zone}</span>
                        </div>
                        <div className="flex-1 bg-amber-400/[0.02]" />
                      </div>

                      {/* Room rows */}
                      {group.rooms.map(room => {
                        const isOOO = room.currentStatus === 'out_of_order'
                        const statusInfo = ROOM_STATUS_TH[room.currentStatus]
                        return (
                          <div key={room.id} className={cn('relative flex border-b border-white/[0.05] group hover:bg-white/[0.015] transition-colors', isOOO ? 'opacity-75' : '')} style={{ height: ROW_H }}>
                            {/* Room label */}
                            <div style={{ width: ROOM_COL_W, minWidth: ROOM_COL_W }}
                              className="sticky left-0 z-10 flex-shrink-0 flex items-center gap-3 border-r border-white/10 bg-black/35 backdrop-blur-xl px-4">
                              {/* Status dot */}
                              <div className={cn('h-2 w-2 flex-shrink-0 rounded-full', statusInfo?.dot || 'bg-stone-600')} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-sm font-bold text-stone-200">{room.roomNumber}</span>
                                  {isOOO && <span className="text-[9px] text-rose-400 font-medium">OOO</span>}
                                </div>
                                <div className="text-[10px] text-stone-600 truncate">{room.roomType.name}</div>
                              </div>
                              {/* OOO toggle on hover */}
                              <button
                                onClick={() => isOOO ? clearOooMutation.mutate(room.id) : setOooDialog({ roomId: room.id, roomNumber: room.roomNumber })}
                                className="opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity text-[9px] px-1.5 py-0.5 rounded border"
                                style={{ background: isOOO ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', borderColor: isOOO ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)', color: isOOO ? '#6ee7b7' : '#fca5a5' }}
                                title={isOOO ? 'เคลียร์ OOO' : 'ตั้ง OOO'}
                              >
                                {isOOO ? '✓' : '⚠'}
                              </button>
                            </div>

                            {/* Day cells */}
                            <div className="relative flex-1">
                              {/* Droppable bg cells */}
                              <div className="absolute inset-0 flex">
                                {dateColumns.map((date, dateIdx) => {
                                  const isToday = isSameDay(date, today)
                                  return (
                                    <DropCell
                                      key={date.toISOString()}
                                      roomId={room.id}
                                      dateIdx={dateIdx}
                                      isOOO={isOOO}
                                      onClick={() => {
                                        const dateStr = format(date, 'yyyy-MM-dd')
                                        const checkOut = format(addDays(date, 1), 'yyyy-MM-dd')
                                        setPrefillDate({ checkIn: dateStr, checkOut: checkOut })
                                        setPrefillRoomTypeId(room.roomType.id)
                                        setPrefillRoomId(room.id)  // pass specific room
                                        setCreateOpen(true)
                                      }}
                                    />
                                  )
                                })}
                              </div>

                              {/* Today highlight */}
                              {(() => {
                                const todayOffset = differenceInDays(today, startDate)
                                if (todayOffset >= 0 && todayOffset < days) {
                                  return <div className="absolute inset-y-0 pointer-events-none bg-amber-400/5" style={{ left: todayOffset * CELL_W, width: CELL_W }} />
                                }
                                return null
                              })()}

                              {/* OOO stripe */}
                              {isOOO && (
                                <div className="absolute inset-y-1 left-0 right-0 flex items-center justify-center mx-0.5 rounded-xl bg-stone-500/15 border border-dashed border-stone-500/25 pointer-events-none">
                                  <span className="text-[10px] text-stone-600 font-medium select-none">ห้องเสีย — Out of Order</span>
                                </div>
                              )}

                              {/* Booking blocks */}
                              {!isOOO && room.bookingRooms?.filter(br => !['cancelled', 'no_show'].includes(br.status)).map(br => {
                                const offset = getStartOffset(br)
                                const width = getWidth(br)
                                if (offset >= days || width <= 0) return null
                                const colorClass = BOOKING_BLOCK_COLORS[br.booking?.status] || BOOKING_BLOCK_COLORS.confirmed
                                return (
                                  <BookingBlock key={br.id} br={br} startOffset={offset} width={width} colorClass={colorClass}
                                    onClick={() => window.location.href = `/bookings/${br.bookingId}`} />
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeDrag && (
              <div className="rounded-xl border border-amber-300/50 bg-amber-400/25 px-3 py-1.5 text-xs font-medium text-amber-100 shadow-xl cursor-grabbing">
                {activeDrag.guestName}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* OOO Dialog */}
      <PmsDialog open={!!oooDialog} onClose={() => setOooDialog(null)} title="ตั้งห้อง Out of Order"
        description={`ห้อง ${oooDialog?.roomNumber} จะถูกนำออกจากการขายชั่วคราว`} size="sm">
        <div className="space-y-4">
          <Input label="เหตุผล *" value={oooReason} onChange={e => setOooReason(e.target.value)}
            placeholder="เช่น แอร์เสีย, น้ำรั่ว, รอซ่อม..." />
          <Button onClick={() => oooDialog && setOooMutation.mutate({ roomId: oooDialog.roomId, reason: oooReason })}
            loading={setOooMutation.isPending} variant="destructive" className="w-full" disabled={!oooReason.trim()}>
            <AlertTriangle className="h-4 w-4" /> ยืนยัน OOO
          </Button>
        </div>
      </PmsDialog>

      <CreateBookingDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSuccess={() => setCreateOpen(false)}
        prefillDate={prefillDate}
        prefillRoomTypeId={prefillRoomTypeId}
        prefillRoomId={prefillRoomId} />
    </AppShell>
  )
}
