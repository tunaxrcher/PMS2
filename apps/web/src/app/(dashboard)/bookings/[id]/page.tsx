'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, User, CalendarRange, BedDouble, Receipt, Printer,
  CheckCircle2, XCircle, DoorOpen, DoorClosed,
  CreditCard, Banknote, ArrowRightLeft, AlertTriangle, Ban, Coins
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { bookingsApi, foliosApi, roomsApi, depositsApi, api } from '@/lib/api'
import { formatDate, formatDateTime, formatCurrency, calcNights } from '@/lib/utils'
import { FolioPanel } from '@/components/bookings/folio-panel'

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

  const checkInMutation = useMutation({
    mutationFn: () => bookingsApi.checkIn(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', id] }); toast.success('Check-in สำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const checkOutMutation = useMutation({
    mutationFn: () => bookingsApi.checkOut(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', id] }); toast.success('Check-out สำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const confirmBookingMutation = useMutation({
    mutationFn: () => bookingsApi.confirm(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', id] }); toast.success('ยืนยันการจองสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(id, { reason: cancelReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', id] }); setCancelDialog(false); toast.success('ยกเลิกการจองสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const addDepositMutation = useMutation({
    mutationFn: () => depositsApi.add(id, {
      amount: Number(depositForm.amount),
      depositType: depositForm.depositType,
      paymentMethod: depositForm.paymentMethod,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', id] }); setDepositDialog(false); setDepositForm({ amount: '', depositType: 'booking_deposit', paymentMethod: 'cash' }); toast.success('รับมัดจำสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const adjustRateMutation = useMutation({
    mutationFn: () => bookingsApi.adjustRate(id, {
      bookingRoomId: rateDialog!.bookingRoomId,
      newRate: Number(rateForm.newRate),
      reason: rateForm.reason,
      adjustmentType: rateForm.adjustmentType,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', id] }); qc.invalidateQueries({ queryKey: ['folio'] }); setRateDialog(null); toast.success('ปรับราคาสำเร็จ') },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', id] }); setEditDialog(false); toast.success('แก้ไขการจองสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const noShowMutation = useMutation({
    mutationFn: () => bookingsApi.noShow(id, { noShowFee: noShowFee ? Number(noShowFee) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', id] }); setNoShowDialog(false); toast.success('บันทึก No Show สำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const assignRoomMutation = useMutation({
    mutationFn: () => bookingsApi.assignRoom(id, { bookingRoomId: assignBookingRoomId, roomId: assignRoomId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking', id] }); setAssignRoomDialog(false); toast.success('กำหนดห้องสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const { data: availableRooms } = useQuery({
    queryKey: ['rooms-available', booking?.checkInDate, booking?.checkOutDate],
    queryFn: () => roomsApi.list({ roomTypeId: booking?.bookingRooms?.[0]?.roomTypeId }).then(r => r.data),
    enabled: assignRoomDialog && !!booking,
  })

  if (isLoading) {
    return (
      <AppShell title="การจอง">
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}</div>
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

  return (
    <AppShell
      title={`การจอง #${booking.bookingNumber}`}
      subtitle={`${booking.guest?.firstName} ${booking.guest?.lastName}`}
      headerActions={
        <Link href="/bookings">
          <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" /> กลับ</Button>
        </Link>
      }
    >
      <div className="space-y-5">
        {/* Pending warning banner */}
        {booking.status === 'pending' && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm">
            <span className="text-amber-400 text-lg">⏳</span>
            <div>
              <div className="font-semibold text-amber-200">การจองนี้รอการยืนยัน</div>
              <div className="text-xs text-amber-400/70 mt-0.5">กด "ยืนยันการจอง" หรือ "รับมัดจำ" เพื่อยืนยันอัตโนมัติ — ยังไม่สามารถ Check-in ได้จนกว่าจะยืนยัน</div>
            </div>
          </div>
        )}

        {/* Status bar */}
        <GlassPanel padding="sm" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={booking.status} />
            <span className="text-sm text-stone-400">สร้างเมื่อ {formatDateTime(booking.createdAt)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {canConfirm && (
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 shadow-emerald-950/30"
                onClick={() => confirmBookingMutation.mutate()} loading={confirmBookingMutation.isPending}>
                <CheckCircle2 className="h-4 w-4" /> ยืนยันการจอง
              </Button>
            )}
            {['confirmed', 'pending'].includes(booking.status) && (
              <Button variant="outline" size="sm" onClick={() => { setEditForm({ checkInDate: booking.checkInDate.split('T')[0], checkOutDate: booking.checkOutDate.split('T')[0], adults: booking.adults, children: booking.children, notes: booking.notes || '' }); setEditDialog(true) }}>
                <Receipt className="h-4 w-4" /> แก้ไข
              </Button>
            )}
            {needsRoomAssign && canCheckIn && (
              <Button variant="secondary" size="sm" onClick={() => { setAssignBookingRoomId(booking.bookingRooms[0].id); setAssignRoomDialog(true) }}>
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
            {['confirmed', 'pending', 'checked_in'].includes(booking.status) && (
              <Button variant="secondary" size="sm" onClick={() => setDepositDialog(true)}>
                <Coins className="h-4 w-4" /> รับมัดจำ
              </Button>
            )}
            {canNoShow && (
              <Button variant="outline" size="sm" onClick={() => setNoShowDialog(true)}>
                <Ban className="h-4 w-4" /> No Show
              </Button>
            )}
            {isCompleted && (
              <Link href={`/bookings/${id}/receipt`}>
                <Button variant="secondary" size="sm">
                  <Printer className="h-4 w-4" /> ใบเสร็จ
                </Button>
              </Link>
            )}
            {canCancel && (
              <Button variant="destructive" size="sm" onClick={() => setCancelDialog(true)}>
                <XCircle className="h-4 w-4" /> ยกเลิก
              </Button>
            )}
          </div>
        </GlassPanel>

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
              {(booking.bookingRooms as Array<{
                id: string
                roomType: { name: string }
                room?: { roomNumber: string; zone?: { name: string } | null } | null
                rate: number | string
              }>).map(br => (
                <div key={br.id} className="rounded-xl bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-stone-200">{br.roomType?.name}</div>
                      {br.room ? (
                        <div className="text-xs text-stone-400">ห้อง {br.room.roomNumber} {br.room.zone?.name ? `• ${br.room.zone.name}` : ''}</div>
                      ) : (
                        <div className="text-xs text-amber-400">ยังไม่ได้กำหนดห้อง</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-amber-300">{formatCurrency(Number(br.rate))}</div>
                      <div className="text-xs text-stone-500">ต่อคืน</div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {!br.room && (
                      <button
                        onClick={() => { setAssignBookingRoomId(br.id); setAssignRoomDialog(true) }}
                        className="flex-1 rounded-lg border border-amber-300/20 bg-amber-400/10 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-400/15 transition-colors"
                      >
                        <BedDouble className="mr-1 inline h-3 w-3" /> กำหนดห้อง
                      </button>
                    )}
                    {['confirmed', 'pending', 'checked_in'].includes(booking.status) && (
                      <button
                        onClick={() => { setRateDialog({ bookingRoomId: br.id, currentRate: Number(br.rate) }); setRateForm({ newRate: String(br.rate), reason: '', adjustmentType: 'manual_override' }) }}
                        className="rounded-lg border border-sky-300/20 bg-sky-400/10 px-2 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-400/15 transition-colors"
                        title="ปรับราคา"
                      >
                        ปรับราคา
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

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

      {/* Assign Room Dialog */}
      <PmsDialog open={assignRoomDialog} onClose={() => setAssignRoomDialog(false)} title="กำหนดห้องพัก" size="md">
        <div className="space-y-4">
          <Select value={assignRoomId} onValueChange={setAssignRoomId}>
            <SelectTrigger label="เลือกห้อง"><SelectValue placeholder="เลือกห้องพัก" /></SelectTrigger>
            <SelectContent>
              {(availableRooms as Array<{ id: string; roomNumber: string; roomName?: string | null; currentStatus: string; zone?: { name: string } | null }> || [])
                .filter(r => !['out_of_order', 'occupied', 'dirty', 'cleaning'].includes(r.currentStatus))
                .map(r => <SelectItem key={r.id} value={r.id}>{r.roomNumber} {r.roomName ? `(${r.roomName})` : ''} {r.zone?.name ? `— ${r.zone.name}` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => assignRoomMutation.mutate()} loading={assignRoomMutation.isPending} className="w-full" disabled={!assignRoomId}>
            กำหนดห้อง
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
