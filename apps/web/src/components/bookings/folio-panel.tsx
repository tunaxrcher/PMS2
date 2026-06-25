'use client'

import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Receipt, Plus, CreditCard, Banknote, ArrowRightLeft, Landmark,
  RotateCcw, Ban, BedDouble, Coffee, UtensilsCrossed, Bed, Clock,
  AlertTriangle, Package, ChevronRight, Tag, Upload, X, ImageOff,
  CheckCircle2,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { foliosApi, paymentsApi, uploadApi } from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

// ── Item type visual config ─────────────────────────────────────────────────
const ITEM_TYPE_CONFIG = [
  { value: 'room_charge',   label: 'ค่าห้อง',    icon: BedDouble,       color: 'text-sky-400',    selBg: 'bg-sky-400/10 border-sky-400/40' },
  { value: 'minibar',       label: 'Minibar',     icon: Coffee,          color: 'text-violet-400', selBg: 'bg-violet-400/10 border-violet-400/40' },
  { value: 'food',          label: 'อาหาร',       icon: UtensilsCrossed, color: 'text-orange-400', selBg: 'bg-orange-400/10 border-orange-400/40' },
  { value: 'extra_bed',     label: 'เตียงเสริม', icon: Bed,             color: 'text-blue-400',   selBg: 'bg-blue-400/10 border-blue-400/40' },
  { value: 'late_checkout', label: 'Late CO',     icon: Clock,           color: 'text-amber-400',  selBg: 'bg-amber-400/10 border-amber-400/40' },
  { value: 'damage',        label: 'เสียหาย',     icon: AlertTriangle,   color: 'text-rose-400',   selBg: 'bg-rose-400/10 border-rose-400/40' },
  { value: 'other',         label: 'อื่นๆ',       icon: Package,         color: 'text-stone-400',  selBg: 'bg-stone-400/10 border-stone-400/40' },
]

const PAYMENT_METHODS = [
  { value: 'cash',        label: 'เงินสด',     icon: Banknote },
  { value: 'transfer',    label: 'โอนเงิน',    icon: ArrowRightLeft },
  { value: 'credit_card', label: 'บัตรเครดิต', icon: CreditCard },
  { value: 'ota',         label: 'OTA',        icon: Landmark },
]

export function FolioPanel({ folioId, bookingStatus }: { folioId: string; bookingStatus: string }) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [addChargeOpen, setAddChargeOpen] = useState(false)
  const [addPaymentOpen, setAddPaymentOpen] = useState(false)
  const [addDiscountOpen, setAddDiscountOpen] = useState(false)
  const [voidItemConfirm, setVoidItemConfirm] = useState<string | null>(null)
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')

  const [chargeForm, setChargeForm] = useState({
    itemType: 'room_charge', description: '', quantity: '1', unitPrice: '',
    serviceDate: new Date().toISOString().split('T')[0],
  })
  const [paymentForm, setPaymentForm] = useState({ paymentMethod: 'cash', amount: '', referenceNo: '' })
  const [discountForm, setDiscountForm] = useState({
    description: '', amount: '', serviceDate: new Date().toISOString().split('T')[0],
  })

  // Slip upload state
  const [slipUrl, setSlipUrl] = useState('')
  const [slipPreview, setSlipPreview] = useState('')
  const [slipUploading, setSlipUploading] = useState(false)

  const { data: folio, isLoading } = useQuery({
    queryKey: ['folio', folioId],
    queryFn: () => foliosApi.get(folioId).then(r => r.data),
    refetchInterval: 15_000,
  })

  const { data: summary } = useQuery({
    queryKey: ['folio-summary', folioId],
    queryFn: () => foliosApi.summary(folioId).then(r => r.data),
    refetchInterval: 15_000,
  })

  const invalidateFolio = () => {
    qc.invalidateQueries({ queryKey: ['folio', folioId] })
    qc.invalidateQueries({ queryKey: ['folio-summary', folioId] })
  }

  const resetChargeForm = () => setChargeForm({
    itemType: 'room_charge', description: '', quantity: '1', unitPrice: '',
    serviceDate: new Date().toISOString().split('T')[0],
  })
  const resetPaymentForm = () => {
    if (slipPreview) URL.revokeObjectURL(slipPreview)
    setPaymentForm({ paymentMethod: 'cash', amount: '', referenceNo: '' })
    setSlipUrl(''); setSlipPreview('')
  }

  const addChargeMutation = useMutation({
    mutationFn: () => foliosApi.addCharge(folioId, { ...chargeForm, quantity: Number(chargeForm.quantity), unitPrice: Number(chargeForm.unitPrice) }),
    onSuccess: () => { invalidateFolio(); setAddChargeOpen(false); resetChargeForm(); toast.success('เพิ่มรายการสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const addPaymentMutation = useMutation({
    mutationFn: () => foliosApi.addPayment(folioId, {
      paymentMethod: paymentForm.paymentMethod,
      amount: Number(paymentForm.amount),
      referenceNo: paymentForm.referenceNo || undefined,
      slipUrl: slipUrl || undefined,
    }),
    onSuccess: () => { invalidateFolio(); setAddPaymentOpen(false); resetPaymentForm(); toast.success('บันทึกการชำระเงินสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const addDiscountMutation = useMutation({
    mutationFn: () => foliosApi.addDiscount(folioId, { ...discountForm, amount: Number(discountForm.amount) }),
    onSuccess: () => { invalidateFolio(); setAddDiscountOpen(false); setDiscountForm({ description: '', amount: '', serviceDate: new Date().toISOString().split('T')[0] }); toast.success('เพิ่มส่วนลดสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const voidItemMutation = useMutation({
    mutationFn: (itemId: string) => foliosApi.voidItem(itemId),
    onSuccess: () => { invalidateFolio(); toast.success('Void รายการสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const closeFolioMutation = useMutation({
    mutationFn: () => foliosApi.close(folioId),
    onSuccess: () => { invalidateFolio(); toast.success('ปิด Folio สำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const voidPaymentMutation = useMutation({
    mutationFn: () => paymentsApi.void(voidPaymentId!, voidReason),
    onSuccess: () => { invalidateFolio(); setVoidPaymentId(null); setVoidReason(''); toast.success('Void การชำระเงินสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const refundPaymentMutation = useMutation({
    mutationFn: () => paymentsApi.refund(refundPaymentId!, Number(refundAmount), refundReason),
    onSuccess: () => { invalidateFolio(); setRefundPaymentId(null); setRefundAmount(''); setRefundReason(''); toast.success('คืนเงินสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Local preview immediately
    setSlipPreview(URL.createObjectURL(file))
    setSlipUploading(true)
    try {
      const res = await uploadApi.slip(file)
      setSlipUrl(res.data.url)
    } catch {
      toast.error('อัพโหลดสลิปไม่สำเร็จ')
      setSlipPreview(''); setSlipUrl('')
    } finally {
      setSlipUploading(false)
    }
  }

  const clearSlip = () => {
    if (slipPreview) URL.revokeObjectURL(slipPreview)
    setSlipPreview(''); setSlipUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isOpen = folio?.status === 'open'
  // Allow adding charges/payments only while actively hosting the guest.
  // confirmed/pending = pre-stay charges OK; checked_in = during stay.
  const canModify = isOpen && ['checked_in', 'confirmed', 'pending'].includes(bookingStatus)
  // Manual "ปิด Folio" is a safety-net only — checkout auto-closes.
  // Only surface it if somehow the folio stayed open after checkout.
  const canManualClose = isOpen && bookingStatus === 'checked_out'
    && summary && (summary.balanceAfterHeld ?? summary.balance) <= 0.01
  const balanceDue = summary ? Math.max(0, summary.balanceAfterHeld ?? summary.balance) : 0
  const chargeTotal = chargeForm.unitPrice && chargeForm.quantity
    ? Number(chargeForm.quantity) * Number(chargeForm.unitPrice) : null
  const needsSlip = ['transfer', 'ota'].includes(paymentForm.paymentMethod)

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />

  return (
    <GlassPanel dense padding="none">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-stone-100">บิล Folio A</h3>
          <StatusBadge status={folio?.status || 'open'} size="sm" />
        </div>
        {canModify && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddDiscountOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-stone-500 hover:text-amber-300 transition-colors"
            >
              <Tag className="h-3 w-3" /> ส่วนลด
            </button>
            <div className="h-3.5 w-px bg-white/10" />
            <Button variant="secondary" size="sm" onClick={() => setAddChargeOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> เพิ่มรายการ
            </Button>
            <Button
              size="sm"
              className="bg-emerald-500/90 hover:bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.2)]"
              onClick={() => setAddPaymentOpen(true)}
            >
              <CreditCard className="h-3.5 w-3.5" /> รับชำระ
            </Button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          RECEIPT MODE — folio is closed (read-only)
      ═══════════════════════════════════════════════════════════ */}
      {!isOpen && folio ? (
        <>
          {/* ── Receipt cards ─────────────────────────────────────── */}
          <div className="px-4 pb-4 pt-3 space-y-3">

            {/* Card 1 — Settlement status */}
            <div className={cn(
              'rounded-2xl border p-4',
              balanceDue <= 0.01
                ? 'bg-emerald-400/[0.07] border-emerald-400/20'
                : 'bg-amber-400/[0.07] border-amber-400/20',
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  balanceDue <= 0.01
                    ? 'bg-emerald-400/20 shadow-[0_0_16px_rgba(52,211,153,0.25)]'
                    : 'bg-amber-400/20',
                )}>
                  {balanceDue <= 0.01
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    : <AlertTriangle className="h-5 w-5 text-amber-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-bold', balanceDue <= 0.01 ? 'text-emerald-300' : 'text-amber-300')}>
                    {balanceDue <= 0.01 ? 'ชำระครบแล้ว' : 'มียอดค้างชำระ'}
                  </p>
                  {folio.closedAt && (
                    <p className="text-xs text-stone-500 mt-0.5">
                      ปิดเมื่อ {new Date(folio.closedAt as string).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-stone-500 mb-0.5">ยอดรวม</p>
                  <p className="text-2xl font-black text-stone-100 tabular-nums leading-none">
                    {formatCurrency(summary?.totalCharges || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2 — Line items */}
            {(folio.items as Array<{ id: string; serviceDate: string; description: string; quantity: number; unitPrice: number | string; totalAmount: number | string }> || []).length > 0 && (
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.04] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07]">
                  <p className="text-xs font-semibold text-stone-400">รายการค่าใช้จ่าย</p>
                  <p className="text-[11px] text-stone-600">
                    {(folio.items as Array<unknown>).length} รายการ
                  </p>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {(folio.items as Array<{ id: string; serviceDate: string; description: string; quantity: number; unitPrice: number | string; totalAmount: number | string }>).map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-200 truncate">{item.description}</p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {formatDate(item.serviceDate, 'dd MMM')}
                          {item.quantity > 1 && <span className="ml-1.5">× {item.quantity} @ {formatCurrency(Number(item.unitPrice))}</span>}
                        </p>
                      </div>
                      <p className={cn('text-sm font-bold tabular-nums flex-shrink-0', Number(item.totalAmount) < 0 ? 'text-rose-400' : 'text-stone-100')}>
                        {formatCurrency(Number(item.totalAmount))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card 3 — Payments */}
            {(folio?.payments as Array<{ id: string; paymentMethod: string; amount: number | string; status: string; referenceNo?: string | null; slipUrl?: string | null }> || []).length > 0 && (
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.04] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.07]">
                  <p className="text-xs font-semibold text-stone-400">การชำระเงิน</p>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {(folio.payments as Array<{ id: string; paymentMethod: string; amount: number | string; status: string; referenceNo?: string | null; slipUrl?: string | null }>).map(p => {
                    const method = PAYMENT_METHODS.find(m => m.value === p.paymentMethod)
                    const PIcon = method?.icon || CreditCard
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="h-8 w-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                          <PIcon className="h-3.5 w-3.5 text-stone-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-300">{method?.label || p.paymentMethod}</p>
                          {p.referenceNo && <p className="text-xs text-stone-600 mt-0.5">#{p.referenceNo}</p>}
                        </div>
                        {p.slipUrl && (
                          <a href={p.slipUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-sky-500/70 hover:text-sky-400 transition-colors text-xs flex-shrink-0">
                            <img src={p.slipUrl} alt="slip" className="h-5 w-5 rounded-md object-cover" />
                            <span>↗</span>
                          </a>
                        )}
                        <p className={cn('text-sm font-bold tabular-nums flex-shrink-0', p.status === 'voided' ? 'line-through text-stone-600' : 'text-emerald-400')}>
                          {formatCurrency(Number(p.amount))}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Card 4 — Outstanding balance (only when owed) */}
            {summary && summary.balance > 0.01 && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-400">ยอดค้างชำระ</p>
                  {summary.totalDepositsApplied > 0 && (
                    <p className="text-[11px] text-stone-600 mt-0.5">หลังหักมัดจำ {formatCurrency(summary.totalDepositsApplied)}</p>
                  )}
                </div>
                <p className="text-2xl font-black tabular-nums text-amber-300 leading-none">
                  {formatCurrency(summary.balance)}
                </p>
              </div>
            )}
          </div>

          {/* ── Safety-net manual close (edge case) ──────────────── */}
          {canManualClose && (
            <div className="flex items-center justify-end border-t border-white/[0.06] px-4 py-2.5">
              <Button
                variant="outline" size="sm"
                onClick={() => closeFolioMutation.mutate()} loading={closeFolioMutation.isPending}
                className="border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10"
              >
                ปิด Folio
              </Button>
            </div>
          )}
        </>
      ) : (
        /* ══════════════════════════════════════════════════════════
           ACTIVE MODE — folio is open
        ═══════════════════════════════════════════════════════════ */
        <>
          {/* ── Safety-net close (only if somehow open after checkout) ── */}
          {canManualClose && (
            <div className="flex items-center justify-end border-b border-white/[0.06] px-5 py-2.5">
              <Button
                variant="outline" size="sm"
                onClick={() => closeFolioMutation.mutate()} loading={closeFolioMutation.isPending}
                className="border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10"
              >
                ปิด Folio
              </Button>
            </div>
          )}

          {/* ── Charge items ──────────────────────────────────────── */}
          <div className="overflow-x-auto">
            {(folio?.items as Array<{ id: string; serviceDate: string; description: string; quantity: number; unitPrice: number | string; totalAmount: number | string }> || []).length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Receipt className="h-8 w-8 text-stone-700" />
                <p className="text-sm text-stone-600">ยังไม่มีรายการ</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-4 py-2 text-left text-xs text-stone-500">วันที่</th>
                    <th className="px-4 py-2 text-left text-xs text-stone-500">รายการ</th>
                    <th className="px-4 py-2 text-right text-xs text-stone-500">จำนวน</th>
                    <th className="px-4 py-2 text-right text-xs text-stone-500">ราคา</th>
                    <th className="px-4 py-2 text-right text-xs text-stone-500">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {(folio!.items as Array<{ id: string; serviceDate: string; description: string; quantity: number; unitPrice: number | string; totalAmount: number | string }>).map(item => (
                    <tr key={item.id} className="border-b border-white/5 group hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5 text-xs text-stone-500 whitespace-nowrap">{formatDate(item.serviceDate, 'dd/MM')}</td>
                      <td className="px-4 py-2.5 text-stone-300">{item.description}</td>
                      <td className="px-4 py-2.5 text-right text-stone-400 tabular-nums">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-stone-400 tabular-nums">{formatCurrency(Number(item.unitPrice))}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={cn('font-medium tabular-nums', Number(item.totalAmount) < 0 ? 'text-rose-400' : 'text-stone-100')}>
                            {formatCurrency(Number(item.totalAmount))}
                          </span>
                          <button
                            onClick={() => setVoidItemConfirm(item.id)}
                            className="opacity-0 group-hover:opacity-100 text-[10px] text-rose-400 border border-rose-400/30 rounded-lg px-1.5 py-0.5 hover:bg-rose-400/10 transition-all"
                          >
                            Void
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Payments ──────────────────────────────────────────── */}
          {(folio?.payments as Array<{ id: string; paidAt: string; paymentMethod: string; amount: number | string; status: string; referenceNo?: string | null; slipUrl?: string | null }> || []).length > 0 && (
            <div className="border-t border-white/10 p-4 space-y-1.5">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">การชำระเงิน</p>
              {(folio!.payments as Array<{ id: string; paidAt: string; paymentMethod: string; amount: number | string; status: string; referenceNo?: string | null; slipUrl?: string | null }>).map(p => {
                const method = PAYMENT_METHODS.find(m => m.value === p.paymentMethod)
                const Icon = method?.icon || CreditCard
                return (
                  <div key={p.id} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-stone-400">
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{method?.label || p.paymentMethod}</span>
                        {p.referenceNo && <span className="text-xs text-stone-600">#{p.referenceNo}</span>}
                        <StatusBadge status={p.status} size="sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-semibold tabular-nums', p.status === 'voided' ? 'line-through text-stone-600' : 'text-emerald-300')}>
                          {formatCurrency(Number(p.amount))}
                        </span>
                        {(p.status === 'paid' || p.status === 'partial_refunded') && (
                          <>
                            <button
                              onClick={() => {
                                const refunded = (p as { refunds?: Array<{ amount: number | string }> }).refunds?.reduce((s, r) => s + Number(r.amount), 0) || 0
                                setRefundPaymentId(p.id); setRefundAmount(String((Number(p.amount) - refunded).toFixed(2))); setRefundReason('')
                              }}
                              className="text-xs text-violet-400 hover:text-violet-300 border border-violet-400/30 rounded-lg px-2 py-0.5 hover:bg-violet-400/10 transition-colors"
                            >
                              คืนเงิน
                            </button>
                            <button
                              onClick={() => { setVoidPaymentId(p.id); setVoidReason('') }}
                              className="text-xs text-rose-400 hover:text-rose-300 border border-rose-400/30 rounded-lg px-2 py-0.5 hover:bg-rose-400/10 transition-colors"
                            >
                              Void
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {p.slipUrl && (
                      <div className="mt-2 flex items-center gap-2">
                        <a href={p.slipUrl} target="_blank" rel="noreferrer" className="group/slip flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 hover:border-white/20 transition-colors">
                          <img src={p.slipUrl} alt="slip" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                          <span className="text-[10px] text-stone-500 group-hover/slip:text-stone-300 transition-colors">ดูสลิป ↗</span>
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Deposits held ─────────────────────────────────────── */}
          {(folio?.deposits as Array<{ id: string; depositType: string; amount: number | string; status: string; paymentMethod: string }> || [])
            .filter(d => d.status === 'held').length > 0 && (
            <div className="border-t border-white/10 p-4 space-y-1.5">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">มัดจำที่ถือไว้ (จะหักตอน Check-out)</p>
              {(folio!.deposits as Array<{ id: string; depositType: string; amount: number | string; status: string; paymentMethod: string }>)
                .filter(d => d.status === 'held')
                .map(d => {
                  const typeLabel: Record<string, string> = { booking_deposit: 'มัดจำการจอง', keycard_deposit: 'มัดจำคีย์การ์ด', damage_deposit: 'มัดจำความเสียหาย' }
                  const methodLabel: Record<string, string> = { cash: 'เงินสด', transfer: 'โอน', credit_card: 'บัตรเครดิต' }
                  return (
                    <div key={d.id} className="flex items-center justify-between rounded-xl bg-amber-400/[0.04] border border-amber-400/10 px-3 py-2">
                      <div className="flex items-center gap-2 text-sm text-stone-400">
                        <span className="text-amber-400/70 text-xs">💰</span>
                        <span>{typeLabel[d.depositType] || d.depositType}</span>
                        <span className="text-xs text-stone-600">({methodLabel[d.paymentMethod] || d.paymentMethod})</span>
                      </div>
                      <span className="text-sm font-semibold text-amber-300 tabular-nums">{formatCurrency(Number(d.amount))}</span>
                    </div>
                  )
                })}
            </div>
          )}

          {/* ── Summary ───────────────────────────────────────────── */}
          {summary && (
            <div className="border-t border-white/10 px-5 py-4">
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between text-stone-400">
                  <span>ยอดรวม</span>
                  <span className="tabular-nums">{formatCurrency(summary.totalCharges)}</span>
                </div>
                {summary.totalPayments > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>ชำระแล้ว</span>
                    <span className="tabular-nums">-{formatCurrency(summary.totalPayments)}</span>
                  </div>
                )}
                {summary.totalDepositsApplied > 0 && (
                  <div className="flex justify-between text-sky-400">
                    <span>มัดจำที่ใช้แล้ว</span>
                    <span className="tabular-nums">-{formatCurrency(summary.totalDepositsApplied)}</span>
                  </div>
                )}
                {summary.totalDepositsHeld > 0 && (
                  <div className="flex justify-between text-amber-400/70 text-xs">
                    <span>มัดจำที่ถือไว้ (จะหักตอน Check-out)</span>
                    <span className="tabular-nums">-{formatCurrency(summary.totalDepositsHeld)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline border-t border-white/10 pt-2.5 mt-0.5">
                  <span className="text-sm font-semibold text-stone-200">ยอดคงเหลือ</span>
                  <span className={cn('text-lg font-black tabular-nums', summary.balance > 0 ? 'text-amber-300' : 'text-emerald-400')}>
                    {formatCurrency(summary.balance)}
                  </span>
                </div>
                {summary.totalDepositsHeld > 0 && summary.balance > 0 && (
                  <div className="flex justify-between text-xs text-emerald-400/80">
                    <span>หลังหักมัดจำ</span>
                    <span className="tabular-nums">{formatCurrency(summary.balanceAfterHeld || 0)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          Dialogs
      ═══════════════════════════════════════════════════════════ */}

      {/* Add Charge Dialog ───────────────────────────────────── */}
      <PmsDialog open={addChargeOpen} onClose={() => setAddChargeOpen(false)} title="เพิ่มรายการ" size="md">
        <div className="space-y-5">

          {/* ① Type — horizontal scrollable chip row */}
          <div>
            <p className="text-xs text-stone-500 mb-2.5">ประเภทรายการ</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5" style={{ scrollbarWidth: 'none' }}>
              {ITEM_TYPE_CONFIG.map(type => {
                const Icon = type.icon
                const isSelected = chargeForm.itemType === type.value
                return (
                  <button
                    key={type.value}
                    onClick={() => setChargeForm(p => ({ ...p, itemType: type.value }))}
                    className={cn(
                      'flex flex-col items-center gap-1.5 flex-shrink-0 rounded-2xl border px-3.5 py-2.5 transition-all',
                      isSelected
                        ? cn(type.selBg, type.color)
                        : 'border-white/[0.08] text-stone-600 hover:border-white/15 hover:text-stone-400 hover:bg-white/[0.04]'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium whitespace-nowrap">{type.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ② Description */}
          <Input
            label="รายละเอียด *"
            value={chargeForm.description}
            onChange={e => setChargeForm(p => ({ ...p, description: e.target.value }))}
            placeholder="รายละเอียดรายการ..."
          />

          {/* ③ Inline equation: qty × price = total */}
          <div>
            <p className="text-xs text-stone-500 mb-2.5">จำนวน × ราคา</p>
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1.3fr] items-end gap-2">
              <Input
                label=""
                type="number" min="1"
                value={chargeForm.quantity}
                onChange={e => setChargeForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="จำนวน"
              />
              <div className="pb-2.5 text-stone-500 text-base font-bold select-none">×</div>
              <Input
                label=""
                type="number" min="0"
                value={chargeForm.unitPrice}
                onChange={e => setChargeForm(p => ({ ...p, unitPrice: e.target.value }))}
                placeholder="ราคา/หน่วย"
              />
              <div className="pb-2.5 text-stone-500 text-base font-bold select-none">=</div>
              {/* Total display */}
              <div className={cn(
                'flex h-10 items-center justify-end rounded-xl border px-3 transition-all',
                chargeTotal !== null
                  ? 'border-amber-400/30 bg-amber-400/[0.08]'
                  : 'border-white/[0.08] bg-transparent'
              )}>
                <span className={cn(
                  'text-base font-black tabular-nums',
                  chargeTotal !== null ? 'text-amber-300' : 'text-stone-700'
                )}>
                  {chargeTotal !== null ? formatCurrency(chargeTotal) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ④ Date */}
          <Input
            label="วันที่"
            type="date"
            value={chargeForm.serviceDate}
            onChange={e => setChargeForm(p => ({ ...p, serviceDate: e.target.value }))}
          />

          {/* ⑤ Submit */}
          <Button
            onClick={() => addChargeMutation.mutate()}
            loading={addChargeMutation.isPending}
            className="w-full"
            disabled={!chargeForm.description || !chargeForm.unitPrice}
          >
            <Plus className="h-4 w-4" />
            {chargeTotal !== null ? `เพิ่มรายการ ${formatCurrency(chargeTotal)}` : 'เพิ่มรายการ'}
          </Button>
        </div>
      </PmsDialog>

      {/* Add Payment Dialog ──────────────────────────────────── */}
      <PmsDialog open={addPaymentOpen} onClose={() => setAddPaymentOpen(false)} title="รับชำระเงิน" size="sm">
        <div className="space-y-4">

          {/* Balance hero */}
          {summary && (
            <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">ยอดค้างชำระ</div>
                <div className="text-2xl font-black text-amber-300 tabular-nums leading-none">
                  {formatCurrency(summary.balanceAfterHeld ?? summary.balance)}
                </div>
              </div>
              {balanceDue > 0 && (
                <button
                  onClick={() => setPaymentForm(p => ({ ...p, amount: String(Number(balanceDue.toFixed(2))) }))}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-400/20 transition-colors"
                >
                  จ่ายเต็มจำนวน <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Payment method grid */}
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(m => {
              const isSelected = paymentForm.paymentMethod === m.value
              return (
                <button
                  key={m.value}
                  onClick={() => { setPaymentForm(p => ({ ...p, paymentMethod: m.value })); clearSlip() }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm transition-all',
                    isSelected
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                      : 'border-white/[0.08] text-stone-400 hover:border-white/15 hover:bg-white/[0.04]'
                  )}
                >
                  <m.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">{m.label}</span>
                </button>
              )
            })}
          </div>

          {/* Amount */}
          <Input
            label="จำนวนเงิน (฿) *"
            type="number" min="0"
            value={paymentForm.amount}
            onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
          />

          {/* Reference No — non-cash only */}
          {['transfer', 'credit_card', 'ota'].includes(paymentForm.paymentMethod) && (
            <Input
              label="เลขอ้างอิง / รหัสอนุมัติ"
              value={paymentForm.referenceNo}
              onChange={e => setPaymentForm(p => ({ ...p, referenceNo: e.target.value }))}
              placeholder="เลขที่โอน / รหัสอนุมัติ..."
            />
          )}

          {/* Slip upload — transfer / OTA only */}
          {needsSlip && (
            <div>
              <p className="text-xs text-stone-500 mb-2">อัพโหลดสลิป</p>
              {slipPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/30">
                  <img src={slipPreview} alt="slip preview" className="w-full max-h-48 object-contain" />
                  {slipUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        <span className="text-xs text-white/60">กำลังอัพโหลด...</span>
                      </div>
                    </div>
                  )}
                  {!slipUploading && (
                    <button
                      onClick={clearSlip}
                      className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!slipUploading && slipUrl && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] text-white">
                      ✓ อัพโหลดแล้ว
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-5 cursor-pointer hover:border-white/25 hover:bg-white/[0.05] transition-all">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06]">
                    <Upload className="h-4 w-4 text-stone-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-stone-400">คลิกเพื่อเลือกสลิป</p>
                    <p className="text-[10px] text-stone-600 mt-0.5">JPG, PNG, WebP — สูงสุด 10MB</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSlipUpload}
                  />
                </label>
              )}
              {needsSlip && !slipUrl && (
                <p className="text-[10px] text-stone-600 mt-1.5 flex items-center gap-1">
                  <ImageOff className="h-3 w-3" /> ไม่มีสลิปก็บันทึกได้ แต่ควรแนบเพื่อเป็นหลักฐาน
                </p>
              )}
            </div>
          )}

          {/* Submit — shows amount */}
          <Button
            onClick={() => addPaymentMutation.mutate()}
            loading={addPaymentMutation.isPending || slipUploading}
            className="w-full bg-emerald-500/90 hover:bg-emerald-400"
            disabled={!paymentForm.amount || Number(paymentForm.amount) <= 0 || slipUploading}
          >
            <CreditCard className="h-4 w-4" />
            {paymentForm.amount && Number(paymentForm.amount) > 0
              ? `รับชำระ ${formatCurrency(Number(paymentForm.amount))}`
              : 'รับชำระ'}
          </Button>
        </div>
      </PmsDialog>

      {/* Add Discount Dialog ─────────────────────────────────── */}
      <PmsDialog open={addDiscountOpen} onClose={() => setAddDiscountOpen(false)} title="เพิ่มส่วนลด" size="sm">
        <div className="space-y-4">
          <Input label="เหตุผลส่วนลด *" value={discountForm.description} onChange={e => setDiscountForm(p => ({ ...p, description: e.target.value }))} placeholder="เช่น ส่วนลดสมาชิก, โปรโมชั่น..." />
          <Input label="จำนวนส่วนลด (฿) *" type="number" value={discountForm.amount} onChange={e => setDiscountForm(p => ({ ...p, amount: e.target.value }))} min="0" />
          <Button onClick={() => addDiscountMutation.mutate()} loading={addDiscountMutation.isPending} className="w-full" disabled={!discountForm.description || !discountForm.amount}>
            <Tag className="h-4 w-4" /> เพิ่มส่วนลด
          </Button>
        </div>
      </PmsDialog>

      {/* Void Item Confirm ───────────────────────────────────── */}
      <ConfirmDialog
        open={!!voidItemConfirm}
        onClose={() => setVoidItemConfirm(null)}
        onConfirm={() => { voidItemMutation.mutate(voidItemConfirm!); setVoidItemConfirm(null) }}
        title="Void รายการ"
        description="รายการนี้จะถูกยกเลิก ไม่สามารถย้อนกลับได้"
        confirmLabel="Void รายการ"
        variant="danger"
        loading={voidItemMutation.isPending}
      />

      {/* Void Payment Dialog ─────────────────────────────────── */}
      <PmsDialog open={!!voidPaymentId} onClose={() => setVoidPaymentId(null)} title="Void การชำระเงิน" description="การ Void จะยกเลิกรายการนี้ ไม่สามารถย้อนกลับได้" size="sm">
        <div className="space-y-4">
          <Input label="เหตุผล *" value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="ระบุเหตุผล..." />
          <Button onClick={() => voidPaymentMutation.mutate()} loading={voidPaymentMutation.isPending} variant="destructive" className="w-full" disabled={!voidReason.trim()}>
            <Ban className="h-4 w-4" /> ยืนยัน Void
          </Button>
        </div>
      </PmsDialog>

      {/* Refund Payment Dialog ───────────────────────────────── */}
      <PmsDialog open={!!refundPaymentId} onClose={() => setRefundPaymentId(null)} title="คืนเงิน" description="ระบุจำนวนเงินที่ต้องการคืน" size="sm">
        <div className="space-y-4">
          <Input label="จำนวนเงินคืน (฿) *" type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} min="0" />
          <Input label="เหตุผล *" value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="เหตุผลในการคืนเงิน..." />
          <Button onClick={() => refundPaymentMutation.mutate()} loading={refundPaymentMutation.isPending} className="w-full bg-violet-500 hover:bg-violet-400" disabled={!refundAmount || !refundReason.trim()}>
            <RotateCcw className="h-4 w-4" /> ยืนยันคืนเงิน
          </Button>
        </div>
      </PmsDialog>
    </GlassPanel>
  )
}
