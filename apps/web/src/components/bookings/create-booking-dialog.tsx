'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, User, ChevronRight, ChevronLeft, CalendarRange, BedDouble, Tag, Package, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { differenceInDays, format, addDays, startOfDay, isBefore } from 'date-fns'
import { th } from 'date-fns/locale'
import { DayPicker, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { bookingsApi, guestsApi, roomTypesApi, roomsApi } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'

interface CreateBookingDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (bookingId: string) => void
  prefillDate?: { checkIn: string; checkOut: string }
  prefillRoomTypeId?: string
  prefillRoomId?: string  // specific room clicked on grid
}

const STEPS = [
  { id: 1, label: 'ลูกค้า & วันที่', icon: CalendarRange },
  { id: 2, label: 'ห้อง & รายละเอียด', icon: BedDouble },
]

const defaultForm = {
  roomTypeId: '',
  checkInDate: '',
  checkOutDate: '',
  adults: 2,
  children: 0,
  rate: 0,
  bookingSourceId: '',
  notes: '',
  packageName: '',
  packageNote: '',
  depositAmount: 0,
  depositMethod: 'cash',
  newGuest: { firstName: '', lastName: '', phone: '', email: '', nationality: '', idType: '', idNumber: '' },
}

export function CreateBookingDialog({ open, onClose, onSuccess, prefillDate, prefillRoomTypeId, prefillRoomId }: CreateBookingDialogProps) {
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [guestSearch, setGuestSearch] = useState('')
  const [selectedGuest, setSelectedGuest] = useState<{ id: string; firstName: string; lastName: string; phone?: string | null } | null>(null)
  const [newGuestMode, setNewGuestMode] = useState(false)
  const [showPackage, setShowPackage] = useState(false)
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(prefillRoomId)
  const [isPending, setIsPending] = useState(false)
  const [form, setForm] = useState({
    ...defaultForm,
    roomTypeId: prefillRoomTypeId || '',
    checkInDate: prefillDate?.checkIn || '',
    checkOutDate: prefillDate?.checkOut || '',
  })

  const { data: guestResults } = useQuery({
    queryKey: ['guest-search', guestSearch],
    queryFn: () => guestsApi.search(guestSearch).then(r => r.data),
    enabled: guestSearch.length >= 2,
  })

  const { data: sources } = useQuery({ queryKey: ['booking-sources'], queryFn: () => bookingsApi.sources().then(r => r.data) })

  // Calendar heatmap — stable date range (memoized so query key never changes mid-session)
  const [calFrom, calTo] = useMemo(() => [
    format(new Date(), 'yyyy-MM-dd'),
    format(addDays(new Date(), 60), 'yyyy-MM-dd'),
  ], [])
  type CalDay = { date: string; totalAvail: number; status: 'available' | 'limited' | 'full' | 'past' }
  const { data: calDays = [] } = useQuery<CalDay[]>({
    queryKey: ['avail-calendar', calFrom, calTo],
    queryFn: () => roomsApi.availabilityCalendar(calFrom, calTo).then(r => r.data),
    enabled: open,
    staleTime: 5 * 60_000,
  })
  const calMap = useMemo(() => {
    const m = new Map<string, CalDay['status']>()
    calDays.forEach(d => m.set(d.date, d.status))
    return m
  }, [calDays])

  // Range selection state (synced with form)
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  // Sync range when prefill dates change or dialog reopens
  React.useEffect(() => {
    if (form.checkInDate && form.checkOutDate) {
      setRange({ from: new Date(form.checkInDate), to: new Date(form.checkOutDate) })
    } else {
      setRange(undefined)
    }
  }, [form.checkInDate, form.checkOutDate])

  const handleRangeSelect = (r: DateRange | undefined) => {
    setRange(r)
    setForm(p => ({
      ...p,
      checkInDate: r?.from ? format(r.from, 'yyyy-MM-dd') : '',
      checkOutDate: r?.to ? format(r.to, 'yyyy-MM-dd') : '',
    }))
    setStepErrors(p => ({ ...p, checkInDate: '', checkOutDate: '' }))
  }

  // Availability query — fetch as soon as dates are set (not waiting for step 2)
  const datesReady = !!(form.checkInDate && form.checkOutDate &&
    differenceInDays(new Date(form.checkOutDate), new Date(form.checkInDate)) > 0)
  const { data: availability, isLoading: availLoading } = useQuery({
    queryKey: ['room-availability', form.checkInDate, form.checkOutDate],
    queryFn: () => roomsApi.availability(form.checkInDate, form.checkOutDate).then(r => r.data),
    enabled: datesReady && open,
    staleTime: 30_000,
  })

  // Available specific rooms for selected room type (via grid endpoint for the date range)
  const { data: gridForType } = useQuery({
    queryKey: ['rooms-grid-type', form.roomTypeId, form.checkInDate, form.checkOutDate],
    queryFn: () => roomsApi.grid(form.checkInDate, form.checkOutDate).then(r => r.data),
    enabled: !!(form.roomTypeId && form.checkInDate && form.checkOutDate && step === 2),
    staleTime: 30_000,
  })
  type GridRoom = { id: string; roomNumber: string; roomName?: string | null; currentStatus: string; roomType: { id: string; name: string }; bookingRooms: Array<{ checkInDate: string; checkOutDate: string; status: string; booking: { status: string } }> }
  const specificRooms: GridRoom[] = ((gridForType as { rooms?: GridRoom[] } | null)?.rooms || []).filter((r: GridRoom) => r.roomType.id === form.roomTypeId)

  type AvailRoom = { roomTypeId: string; roomTypeName: string; description?: string | null; imageUrl?: string | null; baseRate: number | string; maxOccupancy: number; total: number; booked: number; available: number }

  const selectedRt = (availability as AvailRoom[] || []).find(rt => rt.roomTypeId === form.roomTypeId)

  // Auto-fill rate when room type selected OR when availability data loads (for prefill case)
  React.useEffect(() => {
    if (selectedRt && (!form.rate || form.rate === 0)) {
      setForm(p => ({ ...p, rate: Number(selectedRt.baseRate) }))
    }
  }, [form.roomTypeId, selectedRt])

  const nights = form.checkInDate && form.checkOutDate ? differenceInDays(new Date(form.checkOutDate), new Date(form.checkInDate)) : 0
  const totalAmount = form.rate * Math.max(0, nights)

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => bookingsApi.create(data),
    onSuccess: async (res) => {
      const bookingId = res.data.id
      const bookingRoomId = res.data.bookingRooms?.[0]?.id

      // Auto-assign room: use selected room from form, or prefillRoomId from grid click
      const roomToAssign = selectedRoomId || prefillRoomId
      let assigned = false
      if (roomToAssign && bookingRoomId) {
        try {
          await bookingsApi.assignRoom(bookingId, { bookingRoomId, roomId: roomToAssign! })
          assigned = true
        } catch (assignErr: unknown) {
          const msg = (assignErr as { response?: { data?: { message?: string } } })?.response?.data?.message
          console.warn('[assign-room failed]', msg)
          // Show warning but booking is still created
          toast.warning(`สร้างการจองแล้ว แต่กำหนดห้องไม่สำเร็จ: ${msg || 'กรุณากำหนดห้องในหน้าการจอง'}`)
        }
      }

      if (assigned) {
        toast.success(`สร้างการจอง ${res.data.bookingNumber} สำเร็จ — กำหนดห้องแล้ว`)
      } else {
        toast.success(`สร้างการจอง ${res.data.bookingNumber} สำเร็จ`, {
          description: 'ยังไม่ได้กำหนดห้องจริง — จะขึ้นในปฏิทินหลังกำหนดห้อง',
          action: {
            label: 'กำหนดห้อง →',
            onClick: () => window.location.href = `/bookings/${bookingId}`,
          },
          duration: 8000,
        })
      }
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['room-grid'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['guests'] })
      onSuccess(bookingId)
      resetAll()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const resetAll = () => {
    setStep(1); setGuestSearch(''); setSelectedGuest(null); setNewGuestMode(false)
    setShowPackage(false); setStepErrors({}); setSelectedRoomId(prefillRoomId); setIsPending(false)
    setForm({
      ...defaultForm,
      roomTypeId: prefillRoomTypeId || '',
      checkInDate: prefillDate?.checkIn || '',
      checkOutDate: prefillDate?.checkOut || '',
    })
  }

  const validateStep1 = () => {
    const errors: Record<string, string> = {}
    if (!form.checkInDate) errors.checkInDate = 'กรุณาระบุวันเช็คอิน'
    if (!form.checkOutDate) errors.checkOutDate = 'กรุณาระบุวันเช็คเอาท์'
    if (form.checkInDate && form.checkOutDate && new Date(form.checkOutDate) <= new Date(form.checkInDate)) {
      errors.checkOutDate = 'วันเช็คเอาท์ต้องหลังวันเช็คอิน'
    }
    if (!selectedGuest && !newGuestMode) errors.guest = 'กรุณาเลือกหรือสร้างลูกค้า'
    if (newGuestMode && (!form.newGuest.firstName || !form.newGuest.lastName)) errors.guest = 'กรุณาระบุชื่อลูกค้า'
    setStepErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep2 = () => {
    const errors: Record<string, string> = {}
    if (!form.roomTypeId) errors.roomTypeId = 'กรุณาเลือกประเภทห้อง'
    if (form.rate <= 0) errors.rate = 'กรุณาระบุราคา'
    setStepErrors(errors)
    return Object.keys(errors).length === 0
  }

  const goNext = () => {
    if (step === 1 && validateStep1()) setStep(2)
  }

  const handleSubmit = () => {
    if (!validateStep2()) return
    createMutation.mutate({
      guestId: selectedGuest?.id,
      newGuest: newGuestMode ? form.newGuest : undefined,
      roomTypeId: form.roomTypeId,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      adults: form.adults,
      children: form.children,
      rate: form.rate,
      bookingSourceId: form.bookingSourceId || undefined,
      notes: form.notes || undefined,
      packageName: form.packageName || undefined,
      packageNote: form.packageNote || undefined,
      depositAmount: form.depositAmount || undefined,
      depositMethod: form.depositMethod,
      status: isPending ? 'pending' : 'confirmed',
    })
  }

  return (
    <PmsDialog open={open} onClose={() => { onClose(); resetAll() }} title="สร้างการจอง"
      description="กรอกข้อมูลลูกค้าและวันที่พักเพื่อสร้างการจอง" size="xl">

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <button
              onClick={() => s.id < step ? setStep(s.id) : undefined}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                step === s.id
                  ? 'bg-amber-400/15 border border-amber-300/25 text-amber-200'
                  : step > s.id
                  ? 'text-stone-400 hover:text-stone-200 cursor-pointer'
                  : 'text-stone-600 cursor-default'
              }`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step === s.id ? 'bg-amber-400 text-stone-900' : step > s.id ? 'bg-emerald-500/80 text-white' : 'bg-white/10 text-stone-500'
              }`}>
                {step > s.id ? '✓' : s.id}
              </div>
              <span className="hidden sm:block">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${step > i + 1 ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" className="space-y-5"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}>

            {/* === GUEST SECTION === */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold text-stone-200">ข้อมูลลูกค้า</span>
                </div>
                <button onClick={() => { setNewGuestMode(!newGuestMode); setSelectedGuest(null); setStepErrors({}) }}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                  {newGuestMode ? '← ค้นหาลูกค้าเดิม' : '+ สร้างลูกค้าใหม่'}
                </button>
              </div>

              {selectedGuest && !newGuestMode ? (
                <div className="flex items-center justify-between rounded-xl bg-amber-400/10 border border-amber-300/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-400/20 flex items-center justify-center text-xs font-bold text-amber-300">
                      {selectedGuest.firstName[0]}{selectedGuest.lastName[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-amber-100">{selectedGuest.firstName} {selectedGuest.lastName}</div>
                      {selectedGuest.phone && <div className="text-xs text-stone-500">{selectedGuest.phone}</div>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedGuest(null)} className="text-xs text-stone-500 hover:text-stone-300">เปลี่ยน</button>
                </div>
              ) : newGuestMode ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="ชื่อ *" value={form.newGuest.firstName} onChange={e => setForm(p => ({...p, newGuest: {...p.newGuest, firstName: e.target.value}}))} />
                  <Input label="นามสกุล *" value={form.newGuest.lastName} onChange={e => setForm(p => ({...p, newGuest: {...p.newGuest, lastName: e.target.value}}))} />
                  <Input label="เบอร์โทร" value={form.newGuest.phone} onChange={e => setForm(p => ({...p, newGuest: {...p.newGuest, phone: e.target.value.replace(/\D/g,'').slice(0,10)}}))} />
                  <Input label="สัญชาติ" value={form.newGuest.nationality} onChange={e => setForm(p => ({...p, newGuest: {...p.newGuest, nationality: e.target.value}}))} placeholder="ไทย" />
                </div>
              ) : (
                <div>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                    <input value={guestSearch} onChange={e => setGuestSearch(e.target.value)}
                      placeholder="พิมพ์ชื่อหรือเบอร์โทรเพื่อค้นหา..."
                      className="h-9 w-full rounded-xl border border-white/15 bg-black/25 pl-9 pr-4 text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-300/40 focus:outline-none transition-colors" />
                  </div>
                  {guestSearch.length >= 2 && (
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/40">
                      {(guestResults as Array<{ id: string; firstName: string; lastName: string; phone?: string | null }> || []).length === 0 ? (
                        <div className="px-4 py-3 text-xs text-stone-600 text-center">ไม่พบลูกค้า — <button className="text-amber-400 hover:text-amber-300" onClick={() => setNewGuestMode(true)}>สร้างใหม่</button></div>
                      ) : (
                        (guestResults as Array<{ id: string; firstName: string; lastName: string; phone?: string | null }>).map(g => (
                          <button key={g.id} onClick={() => { setSelectedGuest(g); setGuestSearch('') }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] text-sm text-stone-300 hover:text-stone-100 transition-colors">
                            <User className="h-3.5 w-3.5 text-stone-600" />
                            <span className="font-medium">{g.firstName} {g.lastName}</span>
                            {g.phone && <span className="ml-auto text-xs text-stone-600">{g.phone}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              {stepErrors.guest && <p className="mt-2 text-xs text-rose-400">⚠ {stepErrors.guest}</p>}
            </div>

            {/* === DATE SECTION — Calendar heatmap === */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarRange className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold text-stone-200">เลือกวันที่เข้าพัก</span>
                {nights > 0 && (
                  <span className="ml-auto text-xs text-amber-300 font-medium bg-amber-400/10 border border-amber-300/20 rounded-lg px-2 py-0.5">
                    {nights} คืน
                  </span>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mb-3 text-[10px] text-stone-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />ว่าง</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />เหลือน้อย</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />เต็ม</span>
              </div>

              {/* DayPicker with availability heatmap */}
              <style>{`
                .pms-cal { width: 100%; }
                .pms-cal .rdp-root { --rdp-accent-color: #fbbf24; --rdp-accent-background-color: rgba(251,191,36,0.18); color: #e7e5e4; font-family: inherit; width: 100%; }
                .pms-cal .rdp-months { width: 100%; }
                .pms-cal .rdp-month { width: 100%; }
                .pms-cal .rdp-month_grid { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 2px; }
                .pms-cal .rdp-week { width: 100%; }
                .pms-cal .rdp-weekday, .pms-cal .rdp-day { width: 14.28%; }
                .pms-cal .rdp-month_caption { padding: 0 0 8px 0; }
                .pms-cal .rdp-caption_label { font-size: 13px; font-weight: 600; color: #e7e5e4; }
                .pms-cal .rdp-nav { gap: 4px; }
                .pms-cal .rdp-nav button { background: rgba(255,255,255,0.06); border-radius: 8px; width: 26px; height: 26px; color: #a8a29e; }
                .pms-cal .rdp-nav button:hover { background: rgba(255,255,255,0.12); color: #e7e5e4; }
                .pms-cal .rdp-weekday { font-size: 11px; color: #78716c; font-weight: 500; }
                .pms-cal .rdp-day_button { font-size: 13px; border-radius: 8px; width: 100%; height: 38px; position: relative; color: #d6d3d1; background: transparent; border: none; cursor: pointer; }
                .pms-cal .rdp-day_button:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
                .pms-cal .rdp-disabled .rdp-day_button { opacity: 0.25; cursor: default; }
                .pms-cal .rdp-outside .rdp-day_button { opacity: 0.3; }
                .pms-cal .rdp-today .rdp-day_button { border: 1px solid rgba(251,191,36,0.35); color: #fbbf24; }
                .pms-cal .rdp-range_start .rdp-day_button, .pms-cal .rdp-range_end .rdp-day_button { background: #fbbf24 !important; color: #1c1917 !important; font-weight: 700; border-radius: 8px !important; }
                .pms-cal .rdp-range_middle .rdp-day_button { background: rgba(251,191,36,0.14); border-radius: 0; color: #fde68a; }
                .pms-cal .rdp-selected:not(.rdp-range_middle) .rdp-day_button { background: rgba(251,191,36,0.18); color: #fde68a; }
                .pms-cal .avail-dot { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); width: 3px; height: 3px; border-radius: 50%; }
              `}</style>
              <div className="pms-cal">
                <DayPicker
                  mode="range"
                  selected={range}
                  onSelect={handleRangeSelect}
                  locale={th}
                  disabled={[{ before: startOfDay(new Date()) }]}
                  components={{
                    DayButton: ({ day, modifiers, ...props }) => {
                      const dateStr = format(day.date, 'yyyy-MM-dd')
                      const status = calMap.get(dateStr)
                      const dotColor = status === 'available' ? '#4ade80' : status === 'limited' ? '#fbbf24' : status === 'full' ? '#f87171' : undefined
                      return (
                        <button {...props}>
                          {day.date.getDate()}
                          {dotColor && !isBefore(day.date, startOfDay(new Date())) && (
                            <span className="avail-dot" style={{ backgroundColor: dotColor }} />
                          )}
                        </button>
                      )
                    }
                  }}
                />
              </div>

              {/* Selected range summary — single instance */}
              {nights > 0 && (
                <div className="mt-1 rounded-xl bg-amber-400/[0.08] border border-amber-300/20 px-3 py-2 flex items-center gap-3 text-xs">
                  <span className="text-amber-200/80">เข้าพัก {format(new Date(form.checkInDate), 'd MMM', { locale: th })}</span>
                  <div className="flex-1 border-t border-dashed border-amber-300/20 relative">
                    <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-black/40 px-1.5 text-amber-300 font-bold">{nights} คืน</span>
                  </div>
                  <span className="text-amber-200/80">ออก {format(new Date(form.checkOutDate), 'd MMM', { locale: th })}</span>
                </div>
              )}
              {stepErrors.checkInDate && <p className="mt-1 text-xs text-rose-400">⚠ {stepErrors.checkInDate}</p>}

              {/* Availability hint — shows while user is still on step 1 */}
              {datesReady && (
                <div className="mt-2">
                  {availLoading ? (
                    <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-stone-500">
                      <div className="h-3 w-3 animate-spin rounded-full border border-stone-600 border-t-stone-400" />
                      กำลังตรวจสอบห้องว่าง...
                    </div>
                  ) : (() => {
                    const avail = availability as AvailRoom[] || []
                    const totalAvail = avail.reduce((s, rt) => s + rt.available, 0)
                    const availTypes = avail.filter(rt => rt.available > 0).length
                    if (avail.length === 0) return null
                    if (totalAvail === 0) return (
                      <div className="flex items-center gap-2 rounded-xl bg-rose-400/10 border border-rose-400/20 px-3 py-2 text-xs text-rose-300">
                        <span>⚠️</span>
                        <span>ช่วงวันที่นี้ <strong>ไม่มีห้องว่าง</strong> — ทุกประเภทเต็มหมด</span>
                      </div>
                    )
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {avail.map(rt => (
                          <span key={rt.roomTypeId} className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border',
                            rt.available > 0
                              ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-300'
                              : 'bg-rose-400/10 border-rose-400/20 text-rose-400 line-through opacity-60'
                          )}>
                            {rt.roomTypeName}
                            <span className={cn('font-bold', rt.available > 0 ? 'text-emerald-200' : 'text-rose-400')}>
                              {rt.available > 0 ? `${rt.available} ว่าง` : 'เต็ม'}
                            </span>
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            <Button onClick={goNext} className="w-full h-11">
              ถัดไป — เลือกห้อง <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" className="space-y-5"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}>

            {/* Summary from step 1 */}
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm">
              <div className="flex items-center gap-2 text-stone-300">
                <User className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-medium text-amber-200">
                  {selectedGuest ? `${selectedGuest.firstName} ${selectedGuest.lastName}` : `${form.newGuest.firstName} ${form.newGuest.lastName}`}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1 text-stone-500 text-xs">
                <CalendarRange className="h-3.5 w-3.5" />
                {form.checkInDate && form.checkOutDate && `${format(new Date(form.checkInDate), 'd MMM', { locale: th })} – ${format(new Date(form.checkOutDate), 'd MMM', { locale: th })}`}
                <span className="ml-1 text-amber-400 font-medium">({nights} คืน)</span>
              </div>
            </div>

            {/* Room type — availability cards */}
            <div>
              <p className="mb-2 flex items-center gap-1 text-sm font-medium text-stone-300">
                เลือกประเภทห้อง <span className="text-rose-400 text-xs">*</span>
              </p>
              {availLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 rounded-xl bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(availability as AvailRoom[] || []).map(rt => {
                    const isAvail = rt.available > 0
                    const isSelected = form.roomTypeId === rt.roomTypeId
                    return (
                      <button
                        key={rt.roomTypeId}
                        disabled={!isAvail}
                        onClick={() => {
                          if (!isAvail) return
                          setForm(p => ({ ...p, roomTypeId: rt.roomTypeId, rate: Number(rt.baseRate) }))
                          setStepErrors(p => ({ ...p, roomTypeId: '' }))
                        }}
                        className={cn(
                          'relative overflow-hidden rounded-xl border text-left transition-all group',
                          isSelected
                            ? 'border-amber-300/50 ring-2 ring-amber-400/30'
                            : isAvail
                            ? 'border-white/15 hover:border-white/30'
                            : 'border-white/5 opacity-50 cursor-not-allowed',
                          !isAvail && 'grayscale'
                        )}
                      >
                        {/* Room image or gradient placeholder */}
                        <div className="relative h-20 bg-gradient-to-br from-stone-800 to-stone-900 overflow-hidden">
                          {rt.imageUrl && (
                            <img src={rt.imageUrl} alt={rt.roomTypeName} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          )}
                          <div className={cn('absolute inset-0 bg-gradient-to-t', isSelected ? 'from-amber-900/80 via-black/30' : 'from-black/70 via-black/20')} />

                          {/* Selected checkmark */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-amber-400 flex items-center justify-center">
                              <span className="text-[0.625rem] font-bold text-stone-900">✓</span>
                            </div>
                          )}

                          {/* Availability badge */}
                          <div className={cn(
                            'absolute bottom-1.5 right-1.5 rounded-full px-2 py-0.5 text-[0.625rem] font-bold',
                            isAvail ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'
                          )}>
                            {isAvail ? `${rt.available} ห้องว่าง` : 'เต็มแล้ว'}
                          </div>
                        </div>

                        {/* Info */}
                        <div className={cn('p-2.5', isSelected ? 'bg-amber-400/[0.08]' : 'bg-black/20')}>
                          <div className="text-xs font-semibold text-stone-200 truncate">{rt.roomTypeName}</div>
                          <div className="text-[0.6875rem] text-amber-300 font-medium mt-0.5">{formatCurrency(Number(rt.baseRate))}<span className="text-stone-600">/คืน</span></div>
                          <div className="text-[0.625rem] text-stone-600 mt-0.5">{rt.total} ห้องทั้งหมด • {rt.booked} จอง</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {stepErrors.roomTypeId && <p className="mt-1.5 text-xs text-rose-400">⚠ {stepErrors.roomTypeId}</p>}
            </div>

            {/* Specific room picker — show available rooms of selected type */}
            {form.roomTypeId && specificRooms.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-stone-300 flex items-center gap-2">
                  เลือกห้องจริง
                  <span className="text-xs text-stone-600 font-normal">(ไม่บังคับ — สามารถกำหนดภายหลังได้)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {/* Option: No specific room */}
                  <button
                    onClick={() => setSelectedRoomId(undefined)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                      !selectedRoomId
                        ? 'border-stone-400/40 bg-stone-400/15 text-stone-300'
                        : 'border-white/10 text-stone-600 hover:border-white/20 hover:text-stone-400'
                    )}
                  >
                    ยังไม่ระบุห้อง
                  </button>

                  {specificRooms.map(room => {
                    // Check if this specific room has a conflicting booking
                    const hasConflict = room.bookingRooms.some(br => {
                      if (['cancelled', 'no_show'].includes(br.status)) return false
                      if (['cancelled', 'no_show', 'checked_out'].includes(br.booking?.status)) return false
                      const brIn = new Date(br.checkInDate)
                      const brOut = new Date(br.checkOutDate)
                      const newIn = new Date(form.checkInDate)
                      const newOut = new Date(form.checkOutDate)
                      return brIn < newOut && brOut > newIn
                    })
                    const isOOO = room.currentStatus === 'out_of_order'
                    const unavailable = hasConflict || isOOO
                    const isSelected = selectedRoomId === room.id

                    return (
                      <button
                        key={room.id}
                        disabled={unavailable}
                        onClick={() => setSelectedRoomId(isSelected ? undefined : room.id)}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                          isSelected
                            ? 'border-amber-300/50 bg-amber-400/15 text-amber-200'
                            : unavailable
                            ? 'border-white/5 text-stone-700 cursor-not-allowed line-through'
                            : 'border-white/15 text-stone-400 hover:border-amber-300/30 hover:text-stone-200'
                        )}
                        title={unavailable ? (isOOO ? 'ห้องเสีย' : 'ห้องถูกจองแล้ว') : room.roomName || ''}
                      >
                        <span className="font-bold">{room.roomNumber}</span>
                        {room.roomName && <span className="ml-1 opacity-60 font-normal">{room.roomName}</span>}
                        {unavailable && <span className="ml-1 opacity-50">{isOOO ? '⚠' : '✗'}</span>}
                        {isSelected && <span className="ml-1">✓</span>}
                      </button>
                    )
                  })}
                </div>
                {selectedRoomId && (
                  <p className="mt-1.5 text-xs text-amber-400/70">
                    ✓ เลือกห้อง {specificRooms.find(r => r.id === selectedRoomId)?.roomNumber} — จะแสดงในปฏิทินทันทีหลังสร้าง
                  </p>
                )}
              </div>
            )}

            {/* Guests + Rate — only show when room type selected */}
            {form.roomTypeId && (
              <div className="grid grid-cols-3 gap-3">
                <Input label="ผู้ใหญ่" type="number" value={String(form.adults)} onChange={e => setForm(p => ({...p, adults: Number(e.target.value)}))} min="1" max={selectedRt?.maxOccupancy || 20} hint={selectedRt ? `สูงสุด ${selectedRt.maxOccupancy} คน` : undefined} />
                <Input label="เด็ก" type="number" value={String(form.children)} onChange={e => setForm(p => ({...p, children: Number(e.target.value)}))} min="0" max="10" />
                <Input label="ราคา/คืน (฿) *" type="number" value={String(form.rate)} onChange={e => setForm(p => ({...p, rate: Number(e.target.value)}))} min="0" error={stepErrors.rate} hint="แก้ไขได้หากมีราคาพิเศษ" />
              </div>
            )}

            {/* Booking source + Notes */}
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.bookingSourceId} onValueChange={v => setForm(p => ({...p, bookingSourceId: v}))}>
                <SelectTrigger label="ช่องทางการจอง"><SelectValue placeholder="เลือก" /></SelectTrigger>
                <SelectContent>{(sources as Array<{ id: string; name: string }> || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input label="หมายเหตุ" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="หมายเหตุเพิ่มเติม..." />
            </div>

            {/* Package — collapsible */}
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <button onClick={() => setShowPackage(!showPackage)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-stone-500" />
                  <span className="text-stone-400">Package (ไม่บังคับ)</span>
                  {form.packageName && <span className="text-[0.625rem] text-amber-400 bg-amber-400/10 border border-amber-300/20 rounded px-1.5 py-0.5">{form.packageName}</span>}
                </div>
                <ChevronDown className={`h-4 w-4 text-stone-600 transition-transform ${showPackage ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showPackage && (
                  <motion.div className="px-4 pb-4 space-y-3 border-t border-white/[0.07]"
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div className="mt-3">
                      <Input label="ชื่อ Package" value={form.packageName} onChange={e => setForm(p => ({...p, packageName: e.target.value}))} placeholder="เช่น ห้อง + อาหารเช้า + ดำน้ำ" />
                    </div>
                    <Input label="รายละเอียด" value={form.packageNote} onChange={e => setForm(p => ({...p, packageNote: e.target.value}))} placeholder="เช่น อาหารเช้า 2 ท่าน, ดำน้ำ 2 ท่าน, รถรับส่งสนามบิน" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Deposit */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="mb-3 text-xs font-medium text-stone-500 uppercase tracking-wider">เงินมัดจำ (ไม่บังคับ)</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="จำนวนมัดจำ (฿)" type="number" value={String(form.depositAmount)} onChange={e => setForm(p => ({...p, depositAmount: Number(e.target.value)}))} min="0" />
                <Select value={form.depositMethod} onValueChange={v => setForm(p => ({...p, depositMethod: v}))}>
                  <SelectTrigger label="วิธีชำระ"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">เงินสด</SelectItem>
                    <SelectItem value="transfer">โอนเงิน</SelectItem>
                    <SelectItem value="credit_card">บัตรเครดิต</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary */}
            {nights > 0 && form.rate > 0 && (
              <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.06] px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">{formatCurrency(form.rate)} × {nights} คืน</span>
                  <span className="font-semibold text-amber-200 text-base">{formatCurrency(totalAmount)}</span>
                </div>
                {form.depositAmount > 0 && (
                  <div className="flex justify-between text-xs mt-1 text-stone-500">
                    <span>มัดจำ</span>
                    <span>{formatCurrency(form.depositAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tentative booking toggle */}
            <button
              type="button"
              onClick={() => setIsPending(!isPending)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm text-left transition-all',
                isPending
                  ? 'border-amber-300/30 bg-amber-400/[0.07] text-amber-200'
                  : 'border-white/10 bg-white/[0.03] text-stone-500 hover:border-white/20 hover:text-stone-400'
              )}
            >
              <div className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors',
                isPending ? 'border-amber-400 bg-amber-400' : 'border-stone-600 bg-transparent')}>
                {isPending && <span className="text-[0.6875rem] font-bold text-stone-900">✓</span>}
              </div>
              <div>
                <div className="font-medium">จองชั่วคราว (รอยืนยัน)</div>
                <div className="text-xs text-stone-600 mt-0.5">
                  ลูกค้ายังไม่ได้ยืนยัน — ต้องกด "ยืนยันการจอง" หรือรับมัดจำก่อน Check-in ได้
                </div>
              </div>
            </button>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex-1 h-11">
                <ChevronLeft className="h-4 w-4" /> ย้อนกลับ
              </Button>
              <Button onClick={handleSubmit} loading={createMutation.isPending} className="flex-2 flex-[2] h-11"
                disabled={!form.roomTypeId || form.rate <= 0 || createMutation.isPending}>
                {isPending ? 'สร้างจองชั่วคราว' : 'สร้างการจอง'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PmsDialog>
  )
}
