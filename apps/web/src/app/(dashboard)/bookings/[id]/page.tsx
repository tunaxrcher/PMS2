'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, BedDouble, Pencil, Printer,
  CheckCircle2, XCircle, DoorOpen, DoorClosed,
  Ban, Coins, Search, MapPin, MoreHorizontal,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { bookingsApi, roomsApi, depositsApi } from '@/lib/api'
import { formatDateTime, cn } from '@/lib/utils'
import { FolioPanel } from '@/components/bookings/folio-panel'
import { BookingInfoCards } from '@/components/bookings/booking-info-cards'

// ── Room tile slideshow ────────────────────────────────────────
function RoomImageSlideshow({ images, roomNumber, hovered }: { images: Array<{ url: string }>; roomNumber: string; hovered: boolean }) {
  const [idx, setIdx] = React.useState(0)
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null)

  React.useEffect(() => {
    if (hovered && images.length > 1) {
      timer.current = setInterval(() => setIdx(i => (i + 1) % images.length), 1500)
    } else {
      if (timer.current) clearInterval(timer.current)
      if (!hovered) setIdx(0)
    }
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [hovered, images.length])

  if (images.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-stone-900/80">
        <span className="text-2xl opacity-30">📷</span>
        <span className="text-[9px] text-stone-600">ไม่มีรูปภาพ</span>
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      <img
        key={idx}
        src={images[idx].url}
        alt={roomNumber}
        className="h-full w-full object-cover transition-opacity duration-500"
      />
      {/* dots */}
      {images.length > 1 && hovered && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {images.map((_, i) => (
            <span key={i} className={cn('h-1 rounded-full transition-all duration-200', i === idx ? 'w-3 bg-white' : 'w-1 bg-white/40')} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Room picker tile (tracks own hover so slideshow gets the signal) ──
function RoomPickerTile({ r, isSelected, roomImages, onSelect }: {
  r: PickerRoom
  isSelected: boolean
  roomImages: Array<{ url: string }>
  onSelect: (id: string) => void
}) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(isSelected ? '' : r.id)}
      className={cn(
        'relative overflow-hidden rounded-2xl border text-left transition-all duration-150',
        'hover:scale-[1.04] hover:shadow-[0_6px_24px_rgba(0,0,0,0.55)]',
        isSelected
          ? 'ring-2 ring-amber-400/90 border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
          : 'border-white/[0.10] hover:border-white/[0.20]'
      )}
      style={{ minHeight: 100 }}
    >
      {/* Slideshow (receives hovered from parent, not tracking itself) */}
      <RoomImageSlideshow images={roomImages} roomNumber={r.roomNumber} hovered={hovered} />

      {/* Gradient overlay */}
      <div className={cn('absolute inset-0 pointer-events-none bg-gradient-to-t from-black/90 via-black/40', roomImages.length === 0 ? 'to-black/60' : 'to-black/10')} />
      {/* Selected amber tint */}
      {isSelected && <div className="absolute inset-0 pointer-events-none bg-amber-400/15" />}

      {/* Content */}
      <div className="relative flex flex-col justify-end h-full px-2.5 pb-2.5 pt-6 pointer-events-none">
        <span className="text-xl font-black font-mono text-white leading-none drop-shadow">{r.roomNumber}</span>
        {r.roomName && <span className="text-[9px] text-white/60 truncate mt-0.5 leading-tight">{r.roomName}</span>}
        {r.floorNo && <span className="text-[9px] text-white/40 leading-none mt-0.5">ชั้น {r.floorNo}</span>}
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 shadow">
          <span className="text-[9px] font-black text-stone-900">✓</span>
        </div>
      )}
    </button>
  )
}

// ── Visual room picker ────────────────────────────────────────
type PickerRoom = {
  id: string; roomNumber: string; roomName?: string | null; currentStatus: string
  floorNo?: string | null
  images?: Array<{ url: string; isPrimary: boolean }>
  roomType: { id: string; name: string; imageUrl?: string | null }
  zone?: { id: string; name: string; imageUrl?: string | null } | null
}

function RoomPickerDialog({ open, onClose, rooms, loading, selectedId, onSelect, onConfirm, confirming }: {
  open: boolean; onClose: () => void; rooms: PickerRoom[]; loading?: boolean
  selectedId: string; onSelect: (id: string) => void
  onConfirm: () => void; confirming: boolean
}) {
  const [search, setSearch] = React.useState('')

  // Reset search when dialog closes
  React.useEffect(() => { if (!open) setSearch('') }, [open])

  const filtered = React.useMemo(() => {
    if (!search.trim()) return rooms
    const q = search.toLowerCase()
    return rooms.filter(r =>
      r.roomNumber.includes(q) ||
      r.roomName?.toLowerCase().includes(q) ||
      r.zone?.name.toLowerCase().includes(q)
    )
  }, [rooms, search])

  // Group by zone (fall back to "ไม่ระบุโซน")
  const groups = React.useMemo(() => {
    const map = new Map<string, { zoneId: string; zoneName: string; rooms: PickerRoom[] }>()
    filtered.forEach(r => {
      const key = r.zone?.id || '__none__'
      if (!map.has(key)) map.set(key, { zoneId: key, zoneName: r.zone?.name || 'ไม่ระบุโซน', rooms: [] })
      map.get(key)!.rooms.push(r)
    })
    return Array.from(map.values())
  }, [filtered])

  const selectedRoom = rooms.find(r => r.id === selectedId)

  return (
    <PmsDialog open={open} onClose={onClose} title="เลือกห้องพัก" size="lg">
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาเลขห้อง ชื่อห้อง โซน..."
          className="h-9 w-full rounded-full border border-white/15 bg-black/25 pl-9 pr-4 text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-300/40 focus:outline-none"
        />
      </div>

      {/* Room grid */}
      <div className="max-h-[500px] overflow-y-auto pr-0.5 space-y-4">
        {loading ? (
          <div className="grid grid-cols-4 gap-2">
            {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <BedDouble className="h-10 w-10 text-stone-600" />
            <p className="text-sm font-medium text-stone-400">ไม่มีห้องว่างในช่วงวันนี้</p>
            <p className="text-xs text-stone-600">ห้องทุกห้องถูกจองในช่วงวันเดียวกัน</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.zoneId}>
              {/* Zone header */}
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-3 w-3 text-amber-400/70 flex-shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">{group.zoneName}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[10px] text-stone-700">{group.rooms.length} ห้อง</span>
              </div>

              {/* Tiles */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {group.rooms.map(r => {
                  const isSelected = selectedId === r.id
                  const roomImages = r.images || []
                  return (
                    <RoomPickerTile
                      key={r.id}
                      r={r}
                      isSelected={isSelected}
                      roomImages={roomImages}
                      onSelect={onSelect}
                    />
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <div className="text-sm text-stone-500">
          {selectedRoom ? (
            <span className="text-stone-200">
              เลือก <span className="font-bold text-amber-300">ห้อง {selectedRoom.roomNumber}</span>
              {selectedRoom.zone?.name && <span className="text-stone-500"> · {selectedRoom.zone.name}</span>}
            </span>
          ) : (
            <span>{rooms.length} ห้องว่างในช่วงนี้</span>
          )}
        </div>
        <Button
          onClick={onConfirm}
          loading={confirming}
          disabled={!selectedId}
          className="min-w-[120px]"
        >
          ยืนยันห้อง
        </Button>
      </div>
    </PmsDialog>
  )
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const [checkInConfirm, setCheckInConfirm] = useState(false)
  const [checkOutConfirm, setCheckOutConfirm] = useState(false)
  const [cancelDialog, setCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [noShowDialog, setNoShowDialog] = useState(false)
  const [noShowFee, setNoShowFee] = useState('')
  const [editDialog, setEditDialog] = useState(false)
  const [editForm, setEditForm] = useState({ checkInDate: '', checkOutDate: '', adults: 2, children: 0, notes: '' })
  const [rateDialog, setRateDialog] = useState<{ bookingRoomId: string; currentRate: number } | null>(null)
  const [rateForm, setRateForm] = useState({ newRate: '', reason: '', adjustmentType: 'manual_override' })
  const [depositDialog, setDepositDialog] = useState(false)
  const [depositForm, setDepositForm] = useState({ amount: '', depositType: 'booking_deposit', paymentMethod: 'cash' })
  const [assignRoomDialog, setAssignRoomDialog] = useState(false)
  const [assignRoomId, setAssignRoomId] = useState('')
  const [assignBookingRoomId, setAssignBookingRoomId] = useState('')

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id).then(r => r.data),
    refetchInterval: 30_000,
  })

  // A booking action changes shared state seen by the bookings list, room grid,
  // room map and dashboard — invalidate them all so the related views stay in sync.
  const invalidateRelated = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ['booking', id] })
    qc.invalidateQueries({ queryKey: ['bookings'] })
    qc.invalidateQueries({ queryKey: ['room-grid'] })
    qc.invalidateQueries({ queryKey: ['room-map'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['occupancy-forecast'] })
    // Check-out auto-creates a housekeeping task → refresh HK views & dashboard count.
    qc.invalidateQueries({ queryKey: ['housekeeping'] })
    qc.invalidateQueries({ queryKey: ['hk-pending'] })
  }, [qc, id])

  const checkInMutation = useMutation({
    mutationFn: () => bookingsApi.checkIn(id),
    onSuccess: () => { invalidateRelated(); toast.success('Check-in สำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const checkOutMutation = useMutation({
    mutationFn: () => bookingsApi.checkOut(id),
    onSuccess: () => { invalidateRelated(); toast.success('Check-out สำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const confirmBookingMutation = useMutation({
    mutationFn: () => bookingsApi.confirm(id),
    onSuccess: () => { invalidateRelated(); toast.success('ยืนยันการจองสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(id, { reason: cancelReason }),
    onSuccess: () => { invalidateRelated(); setCancelDialog(false); toast.success('ยกเลิกการจองสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const addDepositMutation = useMutation({
    mutationFn: () => depositsApi.add(id, {
      amount: Number(depositForm.amount),
      depositType: depositForm.depositType,
      paymentMethod: depositForm.paymentMethod,
    }),
    onSuccess: () => { invalidateRelated(); qc.invalidateQueries({ queryKey: ['folio'] }); qc.invalidateQueries({ queryKey: ['folio-summary'] }); setDepositDialog(false); setDepositForm({ amount: '', depositType: 'booking_deposit', paymentMethod: 'cash' }); toast.success('รับมัดจำสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const adjustRateMutation = useMutation({
    mutationFn: () => bookingsApi.adjustRate(id, {
      bookingRoomId: rateDialog!.bookingRoomId,
      newRate: Number(rateForm.newRate),
      reason: rateForm.reason,
      adjustmentType: rateForm.adjustmentType,
    }),
    onSuccess: () => { invalidateRelated(); qc.invalidateQueries({ queryKey: ['folio'] }); setRateDialog(null); toast.success('ปรับราคาสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const editMutation = useMutation({
    mutationFn: () => bookingsApi.update(id, {
      checkInDate: editForm.checkInDate || undefined,
      checkOutDate: editForm.checkOutDate || undefined,
      adults: editForm.adults,
      children: editForm.children,
      notes: editForm.notes || undefined,
    }),
    onSuccess: () => { invalidateRelated(); setEditDialog(false); toast.success('แก้ไขการจองสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const noShowMutation = useMutation({
    mutationFn: () => bookingsApi.noShow(id, { noShowFee: noShowFee ? Number(noShowFee) : undefined }),
    onSuccess: () => { invalidateRelated(); setNoShowDialog(false); toast.success('บันทึก No Show สำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const assignRoomMutation = useMutation({
    mutationFn: () => bookingsApi.assignRoom(id, { bookingRoomId: assignBookingRoomId, roomId: assignRoomId }),
    onSuccess: () => { invalidateRelated(); setAssignRoomDialog(false); setAssignRoomId(''); toast.success('กำหนดห้องสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  // Pull the grid (rooms + their bookings in the date range) so we can offer only
  // rooms that are genuinely free for THIS booking's dates — not merely "clean now".
  const { data: assignGrid } = useQuery({
    queryKey: ['rooms-grid-assign', booking?.checkInDate, booking?.checkOutDate],
    queryFn: () => roomsApi.grid(
      booking!.checkInDate.split('T')[0],
      booking!.checkOutDate.split('T')[0],
    ).then(r => r.data),
    enabled: assignRoomDialog && !!booking,
  })

  type GridRoom = {
    id: string; roomNumber: string; roomName?: string | null; currentStatus: string
    floorNo?: string | null
    images?: Array<{ url: string; isPrimary: boolean }>
    roomType: { id: string; name: string; imageUrl?: string | null }
    zone?: { id: string; name: string; imageUrl?: string | null } | null
    bookingRooms?: Array<{ checkInDate: string; checkOutDate: string; status: string }>
  }

  const availableRooms = React.useMemo<GridRoom[]>(() => {
    if (!booking) return []
    const targetBr = (booking.bookingRooms as Array<{ id: string; roomTypeId: string }>)?.find(br => br.id === assignBookingRoomId)
    const targetRoomTypeId = targetBr?.roomTypeId
    const ci = new Date(booking.checkInDate)
    const co = new Date(booking.checkOutDate)
    const allRooms = ((assignGrid as { rooms?: GridRoom[] } | undefined)?.rooms) || []
    return allRooms.filter(r => {
      if (targetRoomTypeId && r.roomType.id !== targetRoomTypeId) return false
      if (['out_of_order', 'out_of_service', 'dirty', 'cleaning'].includes(r.currentStatus)) return false
      const overlaps = r.bookingRooms?.some(br =>
        !['cancelled', 'no_show'].includes(br.status) &&
        new Date(br.checkInDate) < co && new Date(br.checkOutDate) > ci
      )
      return !overlaps
    })
  }, [assignGrid, booking, assignBookingRoomId])

  if (isLoading) {
    return (
      <AppShell title="การจอง">
        <div className="space-y-5">
          {/* Status bar */}
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-3.5 w-36" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-xl" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          </div>
          {/* 2-col content */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!booking) {
    return (
      <AppShell title="ไม่พบการจอง">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-4xl">🔍</div>
          <h2 className="text-lg font-semibold text-stone-300">ไม่พบการจองนี้</h2>
          <p className="text-stone-500 text-sm">อาจถูกลบหรือไม่มีสิทธิ์เข้าถึง</p>
          <Link href="/bookings"><Button variant="secondary">← กลับรายการจอง</Button></Link>
        </div>
      </AppShell>
    )
  }

  const folio = booking.folios?.[0]
  const canConfirm = booking.status === 'pending'
  const canCheckIn = booking.status === 'confirmed'
  const canCheckOut = booking.status === 'checked_in'
  const canCancel = ['confirmed', 'pending'].includes(booking.status)
  const canNoShow = booking.status === 'confirmed'
  const isCompleted = ['checked_out', 'cancelled', 'no_show'].includes(booking.status)
  const needsRoomAssign = booking.bookingRooms?.some((br: { roomId?: string | null }) => !br.roomId)

  // 5-step progress
  const BOOKING_STEPS = [
    { key: 'pending',     label: 'รอยืนยัน' },
    { key: 'confirmed',   label: 'ยืนยันแล้ว' },
    { key: 'assign',      label: 'กำหนดห้อง' },
    { key: 'checked_in',  label: 'Check-in' },
    { key: 'checked_out', label: 'Check-out' },
  ]
  // confirmed + needs room → current = step 2 (กำหนดห้อง)
  // confirmed + room assigned → current = step 3 (Check-in)
  // checked_in → current = step 4 (Check-out)
  // checked_out/cancelled/no_show → all done (stepIndex beyond array)
  const stepIndex = booking.status === 'pending' ? 0
    : (booking.status === 'confirmed' && needsRoomAssign) ? 2
    : booking.status === 'confirmed' ? 3
    : booking.status === 'checked_in' ? 4
    : 5

  return (
    <AppShell
      title={`${booking.guest?.firstName} ${booking.guest?.lastName}`}
      subtitle={`#${booking.bookingNumber} · สร้างเมื่อ ${formatDateTime(booking.createdAt)}`}
      headerActions={
        <Link href="/bookings">
          <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" /> กลับ</Button>
        </Link>
      }
    >
      <div className="space-y-5">

        {/* Completed status banner */}
        {isCompleted && (
          <div className={cn(
            'flex items-center gap-3 rounded-2xl border px-4 py-3.5',
            booking.status === 'checked_out' && 'border-emerald-400/30 bg-emerald-400/[0.08]',
            booking.status === 'cancelled'   && 'border-rose-400/30 bg-rose-400/[0.08]',
            booking.status === 'no_show'     && 'border-amber-400/30 bg-amber-400/[0.08]',
          )}>
            {booking.status === 'checked_out' && <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />}
            {booking.status === 'cancelled'   && <XCircle      className="h-5 w-5 text-rose-400 flex-shrink-0" />}
            {booking.status === 'no_show'     && <Ban          className="h-5 w-5 text-amber-400 flex-shrink-0" />}
            <div>
              <div className={cn('text-sm font-semibold',
                booking.status === 'checked_out' && 'text-emerald-200',
                booking.status === 'cancelled'   && 'text-rose-200',
                booking.status === 'no_show'     && 'text-amber-200',
              )}>
                {booking.status === 'checked_out' && 'Check-out เสร็จสิ้น'}
                {booking.status === 'cancelled'   && 'ยกเลิกการจองแล้ว'}
                {booking.status === 'no_show'     && 'บันทึก No Show แล้ว'}
              </div>
              <div className="text-xs text-stone-500 mt-0.5">การจองนี้ปิดแล้ว ไม่สามารถดำเนินการเพิ่มเติมได้</div>
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {!isCompleted && (
          <div className="flex items-center gap-0 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-4 overflow-x-auto">
            {BOOKING_STEPS.map((step, i) => {
              const done = i < stepIndex
              const current = i === stepIndex
              return (
                <div key={step.key} className="flex items-center flex-shrink-0" style={{ flex: i < BOOKING_STEPS.length - 1 ? '1 0 auto' : undefined }}>
                  <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
                    <div className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                      done ? 'bg-emerald-500 border-emerald-500 text-white'
                        : current ? 'bg-white border-white text-stone-900'
                        : 'border-white/20 bg-transparent text-stone-600'
                    )}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={cn('text-[10px] font-medium whitespace-nowrap',
                      done ? 'text-emerald-400' : current ? 'text-stone-100' : 'text-stone-600'
                    )}>{step.label}</span>
                  </div>
                  {i < BOOKING_STEPS.length - 1 && (
                    <div className={cn('flex-1 h-[2px] mb-5 mx-1', done ? 'bg-emerald-500/40' : 'bg-white/[0.08]')} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Contextual callout */}
        {booking.status === 'pending' && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3">
            <span className="text-amber-400 mt-0.5">⏳</span>
            <div>
              <div className="text-sm font-semibold text-amber-200">รอการยืนยัน</div>
              <div className="text-xs text-amber-400/70 mt-0.5">กด "ยืนยันการจอง" หรือ "รับมัดจำ" เพื่อยืนยันอัตโนมัติ</div>
            </div>
          </div>
        )}
        {needsRoomAssign && canCheckIn && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3">
            <BedDouble className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-200">ยังไม่ได้กำหนดห้อง</div>
              <div className="text-xs text-amber-400/70 mt-0.5">กรุณากำหนดเลขห้องก่อนทำ Check-in</div>
            </div>
          </div>
        )}

        {/* Action bar — primary | secondary | ⋯ danger */}
        <GlassPanel padding="sm">
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary action (one at a time) */}
            {canConfirm && (
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400"
                onClick={() => confirmBookingMutation.mutate()} loading={confirmBookingMutation.isPending}>
                <CheckCircle2 className="h-4 w-4" /> ยืนยันการจอง
              </Button>
            )}
            {needsRoomAssign && canCheckIn && (
              <Button size="sm" onClick={() => {
                const unassigned = booking.bookingRooms.find((br: { id: string; roomId?: string | null }) => !br.roomId)
                setAssignBookingRoomId(unassigned?.id || booking.bookingRooms[0].id)
                setAssignRoomId('')
                setAssignRoomDialog(true)
              }}>
                <BedDouble className="h-4 w-4" /> กำหนดห้อง
              </Button>
            )}
            {canCheckIn && !needsRoomAssign && (
              <Button size="sm" onClick={() => setCheckInConfirm(true)} loading={checkInMutation.isPending}>
                <DoorOpen className="h-4 w-4" /> Check-in
              </Button>
            )}
            {canCheckOut && (
              <Button size="sm" onClick={() => setCheckOutConfirm(true)} loading={checkOutMutation.isPending}>
                <DoorClosed className="h-4 w-4" /> Check-out
              </Button>
            )}

            {/* Secondary actions */}
            {['confirmed', 'pending'].includes(booking.status) && (
              <Button variant="secondary" size="sm" onClick={() => { setEditForm({ checkInDate: booking.checkInDate.split('T')[0], checkOutDate: booking.checkOutDate.split('T')[0], adults: booking.adults, children: booking.children, notes: booking.notes || '' }); setEditDialog(true) }}>
                <Pencil className="h-4 w-4" /> แก้ไข
              </Button>
            )}
            {['confirmed', 'pending', 'checked_in'].includes(booking.status) && (
              <Button variant="secondary" size="sm" onClick={() => setDepositDialog(true)}>
                <Coins className="h-4 w-4" /> รับมัดจำ
              </Button>
            )}
            {booking.status === 'checked_out' && (
              <Link href={`/bookings/${id}/receipt`}>
                <Button variant="secondary" size="sm">
                  <Printer className="h-4 w-4" /> ใบเสร็จ
                </Button>
              </Link>
            )}

            {/* Danger actions — tucked in ⋯ dropdown */}
            {(canNoShow || canCancel) && (
              <div className="ml-auto">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-stone-500 hover:bg-white/[0.06] hover:text-stone-300 transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content align="end" sideOffset={6}
                      className="z-50 min-w-[160px] rounded-2xl border border-white/[0.12] bg-[#1c1612]/95 p-1.5 shadow-2xl backdrop-blur-xl">
                      {canNoShow && (
                        <DropdownMenu.Item onSelect={() => setNoShowDialog(true)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-amber-300 outline-none cursor-pointer hover:bg-amber-400/10 data-[highlighted]:bg-amber-400/10">
                          <Ban className="h-3.5 w-3.5" /> No Show
                        </DropdownMenu.Item>
                      )}
                      {canCancel && (
                        <DropdownMenu.Item onSelect={() => setCancelDialog(true)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-400 outline-none cursor-pointer hover:bg-rose-400/10 data-[highlighted]:bg-rose-400/10">
                          <XCircle className="h-3.5 w-3.5" /> ยกเลิกการจอง
                        </DropdownMenu.Item>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            )}
          </div>
        </GlassPanel>

        <BookingInfoCards
          booking={booking}
          onAssignRoom={(brId) => { setAssignBookingRoomId(brId); setAssignRoomId(''); setAssignRoomDialog(true) }}
          onAdjustRate={(brId, currentRate) => {
            setRateDialog({ bookingRoomId: brId, currentRate })
            setRateForm({ newRate: String(currentRate), reason: '', adjustmentType: 'manual_override' })
          }}
        />

        {/* Folio */}
        {folio && <FolioPanel folioId={folio.id} bookingStatus={booking.status} />}
      </div>

      {/* Cancel Dialog */}
      <PmsDialog open={cancelDialog} onClose={() => setCancelDialog(false)} title="ยกเลิกการจอง" description="กรุณาระบุเหตุผลในการยกเลิก" size="sm">
        <div className="space-y-4">
          <Input label="เหตุผล *" value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="เหตุผลในการยกเลิก..." />
          <Button onClick={() => cancelMutation.mutate()} loading={cancelMutation.isPending} variant="destructive" className="w-full" disabled={!cancelReason.trim()}>
            ยืนยันการยกเลิก
          </Button>
        </div>
      </PmsDialog>

      {/* Deposit Dialog */}
      <PmsDialog open={depositDialog} onClose={() => setDepositDialog(false)} title="รับเงินมัดจำ" description="บันทึกการรับเงินมัดจำจากลูกค้า" size="sm">
        <div className="space-y-4">
          <Input label="จำนวนมัดจำ (฿) *" type="number" value={depositForm.amount} onChange={e => setDepositForm(p => ({...p, amount: e.target.value}))} min="1" placeholder="0" />
          <Select value={depositForm.depositType} onValueChange={v => setDepositForm(p => ({...p, depositType: v}))}>
            <SelectTrigger label="ประเภทมัดจำ"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="booking_deposit">มัดจำการจอง</SelectItem>
              <SelectItem value="keycard_deposit">มัดจำคีย์การ์ด</SelectItem>
              <SelectItem value="damage_deposit">มัดจำความเสียหาย</SelectItem>
            </SelectContent>
          </Select>
          <Select value={depositForm.paymentMethod} onValueChange={v => setDepositForm(p => ({...p, paymentMethod: v}))}>
            <SelectTrigger label="วิธีชำระ"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">เงินสด</SelectItem>
              <SelectItem value="transfer">โอนเงิน</SelectItem>
              <SelectItem value="credit_card">บัตรเครดิต</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => addDepositMutation.mutate()} loading={addDepositMutation.isPending} className="w-full" disabled={!depositForm.amount || Number(depositForm.amount) <= 0}>
            <Coins className="h-4 w-4" /> รับมัดจำ
          </Button>
        </div>
      </PmsDialog>

      {/* Check-in Confirm */}
      <ConfirmDialog
        open={checkInConfirm}
        onClose={() => setCheckInConfirm(false)}
        onConfirm={() => { setCheckInConfirm(false); checkInMutation.mutate() }}
        title="ยืนยัน Check-in"
        description={`Check-in ให้ ${booking?.guest?.firstName} ${booking?.guest?.lastName} — ${booking?.bookingRooms?.[0]?.room?.roomNumber || booking?.bookingRooms?.[0]?.roomType?.name}`}
        confirmLabel="✓ Check-in เลย"
        variant="success"
        loading={checkInMutation.isPending}
      />

      {/* Check-out Confirm */}
      <ConfirmDialog
        open={checkOutConfirm}
        onClose={() => setCheckOutConfirm(false)}
        onConfirm={() => { setCheckOutConfirm(false); checkOutMutation.mutate() }}
        title="ยืนยัน Check-out"
        description="ระบบจะปิด Folio และสร้างงานแม่บ้านอัตโนมัติ ยืนยันหรือไม่?"
        confirmLabel="✓ Check-out เลย"
        variant="warning"
        loading={checkOutMutation.isPending}
      />

      {/* Adjust Rate Dialog */}
      <PmsDialog open={!!rateDialog} onClose={() => setRateDialog(null)} title="ปรับราคาห้องพัก" description={rateDialog ? `ราคาปัจจุบัน: ${rateDialog.currentRate.toLocaleString()} ฿/คืน` : ''} size="sm">
        <div className="space-y-4">
          <Input label="ราคาใหม่ (฿/คืน) *" type="number" value={rateForm.newRate} onChange={e => setRateForm(p => ({...p, newRate: e.target.value}))} min="0" />
          <Select value={rateForm.adjustmentType} onValueChange={v => setRateForm(p => ({...p, adjustmentType: v}))}>
            <SelectTrigger label="ประเภทการปรับ"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual_override">Manual Override</SelectItem>
              <SelectItem value="discount">ส่วนลด</SelectItem>
              <SelectItem value="surcharge">ค่าธรรมเนียมเพิ่มเติม</SelectItem>
            </SelectContent>
          </Select>
          <Input label="เหตุผล *" value={rateForm.reason} onChange={e => setRateForm(p => ({...p, reason: e.target.value}))} placeholder="ระบุเหตุผลในการปรับราคา..." />
          {rateForm.newRate && rateDialog && (
            <div className="rounded-xl border border-sky-300/20 bg-sky-400/5 px-4 py-2 text-xs text-sky-300">
              {Number(rateForm.newRate) < rateDialog.currentRate
                ? `ลดราคา: -${(rateDialog.currentRate - Number(rateForm.newRate)).toLocaleString()} ฿/คืน`
                : `เพิ่มราคา: +${(Number(rateForm.newRate) - rateDialog.currentRate).toLocaleString()} ฿/คืน`}
            </div>
          )}
          <Button onClick={() => adjustRateMutation.mutate()} loading={adjustRateMutation.isPending} className="w-full"
            disabled={!rateForm.newRate || !rateForm.reason.trim()}>
            ยืนยันการปรับราคา
          </Button>
        </div>
      </PmsDialog>

      {/* Edit Booking Dialog */}
      <PmsDialog open={editDialog} onClose={() => setEditDialog(false)} title="แก้ไขการจอง" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="วันเช็คอิน" type="date" value={editForm.checkInDate} onChange={e => setEditForm(p => ({...p, checkInDate: e.target.value}))} />
            <Input label="วันเช็คเอาท์" type="date" value={editForm.checkOutDate} onChange={e => setEditForm(p => ({...p, checkOutDate: e.target.value}))} min={editForm.checkInDate} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="ผู้ใหญ่" type="number" value={String(editForm.adults)} onChange={e => setEditForm(p => ({...p, adults: Number(e.target.value)}))} min="1" max="20" />
            <Input label="เด็ก" type="number" value={String(editForm.children)} onChange={e => setEditForm(p => ({...p, children: Number(e.target.value)}))} min="0" max="20" />
          </div>
          <Input label="หมายเหตุ" value={editForm.notes} onChange={e => setEditForm(p => ({...p, notes: e.target.value}))} placeholder="หมายเหตุเพิ่มเติม..." />
          <Button onClick={() => editMutation.mutate()} loading={editMutation.isPending} className="w-full">
            บันทึกการเปลี่ยนแปลง
          </Button>
        </div>
      </PmsDialog>

      {/* No Show Dialog */}
      <PmsDialog open={noShowDialog} onClose={() => setNoShowDialog(false)} title="บันทึก No Show" description="ลูกค้าไม่มาเข้าพักตามกำหนด" size="sm">
        <div className="space-y-4">
          <Input label="ค่าปรับ No Show (฿)" type="number" value={noShowFee} onChange={e => setNoShowFee(e.target.value)} placeholder="0 = ไม่คิดค่าปรับ" min="0" />
          <Button onClick={() => noShowMutation.mutate()} loading={noShowMutation.isPending} variant="destructive" className="w-full">
            ยืนยัน No Show
          </Button>
        </div>
      </PmsDialog>

      {/* Assign Room Dialog — visual room picker */}
      <RoomPickerDialog
        open={assignRoomDialog}
        onClose={() => { setAssignRoomDialog(false); setAssignRoomId('') }}
        rooms={availableRooms}
        loading={!assignGrid && assignRoomDialog}
        selectedId={assignRoomId}
        onSelect={setAssignRoomId}
        onConfirm={() => assignRoomMutation.mutate()}
        confirming={assignRoomMutation.isPending}
      />
    </AppShell>
  )
}
