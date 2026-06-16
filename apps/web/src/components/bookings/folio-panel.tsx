'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Receipt, Plus, CreditCard, Banknote, ArrowRightLeft, Landmark, RotateCcw, Ban } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { foliosApi, paymentsApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

const FOLIO_ITEM_TYPES = [
  { value: 'room_charge', label: 'ค่าห้อง' },
  { value: 'minibar', label: 'Minibar' },
  { value: 'food', label: 'อาหาร' },
  { value: 'extra_bed', label: 'เตียงเสริม' },
  { value: 'late_checkout', label: 'Late Checkout' },
  { value: 'damage', label: 'ค่าเสียหาย' },
  { value: 'other', label: 'อื่นๆ' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'เงินสด', icon: Banknote },
  { value: 'transfer', label: 'โอนเงิน', icon: ArrowRightLeft },
  { value: 'credit_card', label: 'บัตรเครดิต', icon: CreditCard },
  { value: 'ota', label: 'OTA', icon: Landmark },
]

export function FolioPanel({ folioId, bookingStatus }: { folioId: string; bookingStatus: string }) {
  const qc = useQueryClient()
  const [addChargeOpen, setAddChargeOpen] = useState(false)
  const [addPaymentOpen, setAddPaymentOpen] = useState(false)
  const [addDiscountOpen, setAddDiscountOpen] = useState(false)
  const [voidItemConfirm, setVoidItemConfirm] = useState<string | null>(null)
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [chargeForm, setChargeForm] = useState({ itemType: 'other', description: '', quantity: '1', unitPrice: '', serviceDate: new Date().toISOString().split('T')[0] })
  const [paymentForm, setPaymentForm] = useState({ paymentMethod: 'cash', amount: '', referenceNo: '' })
  const [discountForm, setDiscountForm] = useState({ description: '', amount: '', serviceDate: new Date().toISOString().split('T')[0] })

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

  const addChargeMutation = useMutation({
    mutationFn: () => foliosApi.addCharge(folioId, { ...chargeForm, quantity: Number(chargeForm.quantity), unitPrice: Number(chargeForm.unitPrice) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folio', folioId] }); qc.invalidateQueries({ queryKey: ['folio-summary', folioId] }); setAddChargeOpen(false); toast.success('เพิ่มรายการสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const addPaymentMutation = useMutation({
    mutationFn: () => foliosApi.addPayment(folioId, { paymentMethod: paymentForm.paymentMethod, amount: Number(paymentForm.amount), referenceNo: paymentForm.referenceNo || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folio', folioId] }); qc.invalidateQueries({ queryKey: ['folio-summary', folioId] }); setAddPaymentOpen(false); toast.success('บันทึกการชำระเงินสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const addDiscountMutation = useMutation({
    mutationFn: () => foliosApi.addDiscount(folioId, { ...discountForm, amount: Number(discountForm.amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folio', folioId] }); qc.invalidateQueries({ queryKey: ['folio-summary', folioId] }); setAddDiscountOpen(false); toast.success('เพิ่มส่วนลดสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const voidItemMutation = useMutation({
    mutationFn: (itemId: string) => foliosApi.voidItem(itemId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folio', folioId] }); qc.invalidateQueries({ queryKey: ['folio-summary', folioId] }); toast.success('Void รายการสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const closeFolioMutation = useMutation({
    mutationFn: () => foliosApi.close(folioId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folio', folioId] }); qc.invalidateQueries({ queryKey: ['folio-summary', folioId] }); toast.success('ปิด Folio สำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const voidPaymentMutation = useMutation({
    mutationFn: () => paymentsApi.void(voidPaymentId!, voidReason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folio', folioId] }); qc.invalidateQueries({ queryKey: ['folio-summary', folioId] }); setVoidPaymentId(null); setVoidReason(''); toast.success('Void การชำระเงินสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const refundPaymentMutation = useMutation({
    mutationFn: () => paymentsApi.refund(refundPaymentId!, Number(refundAmount), refundReason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folio', folioId] }); qc.invalidateQueries({ queryKey: ['folio-summary', folioId] }); setRefundPaymentId(null); setRefundAmount(''); setRefundReason(''); toast.success('คืนเงินสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const isOpen = folio?.status === 'open'
  const canModify = isOpen && ['checked_in', 'confirmed', 'pending'].includes(bookingStatus)

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />

  return (
    <GlassPanel dense padding="none">
      {/* Folio header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-stone-100">บิล Folio A</h3>
          <StatusBadge status={folio?.status || 'open'} size="sm" />
        </div>
        {canModify && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAddDiscountOpen(true)}>ส่วนลด</Button>
            <Button variant="secondary" size="sm" onClick={() => setAddChargeOpen(true)}><Plus className="h-3.5 w-3.5" /> เพิ่มรายการ</Button>
            <Button size="sm" onClick={() => setAddPaymentOpen(true)}><CreditCard className="h-3.5 w-3.5" /> รับชำระ</Button>
            {summary && (summary.balanceAfterHeld ?? summary.balance) <= 0.01 && (
              <Button variant="outline" size="sm" onClick={() => closeFolioMutation.mutate()} loading={closeFolioMutation.isPending}
                className="border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10">
                ปิด Folio
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/10 bg-white/[0.03]">
            <th className="px-4 py-2 text-left text-xs text-stone-500">วันที่</th>
            <th className="px-4 py-2 text-left text-xs text-stone-500">รายการ</th>
            <th className="px-4 py-2 text-right text-xs text-stone-500">จำนวน</th>
            <th className="px-4 py-2 text-right text-xs text-stone-500">ราคา</th>
            <th className="px-4 py-2 text-right text-xs text-stone-500">รวม</th>
          </tr></thead>
          <tbody>
            {(folio?.items as Array<{ id: string; serviceDate: string; description: string; quantity: number; unitPrice: number | string; totalAmount: number | string }> || []).map(item => (
              <tr key={item.id} className="border-b border-white/5 group">
                <td className="px-4 py-2 text-xs text-stone-500">{formatDate(item.serviceDate, 'dd/MM')}</td>
                <td className="px-4 py-2 text-stone-300">{item.description}</td>
                <td className="px-4 py-2 text-right text-stone-400">{item.quantity}</td>
                <td className="px-4 py-2 text-right text-stone-400">{formatCurrency(Number(item.unitPrice))}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-medium" style={{ color: Number(item.totalAmount) < 0 ? '#f87171' : '#e5e7eb' }}>
                      {formatCurrency(Number(item.totalAmount))}
                    </span>
                    {isOpen && (
                      <button
                        onClick={() => setVoidItemConfirm(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-rose-400 border border-rose-400/30 rounded px-1.5 py-0.5 hover:bg-rose-400/10 transition-all"
                        title="Void รายการ"
                      >
                        Void
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments */}
      {(folio?.payments as Array<{ id: string; paidAt: string; paymentMethod: string; amount: number | string; status: string; referenceNo?: string | null }> || []).length > 0 && (
        <div className="border-t border-white/10 p-4">
          <p className="mb-2 text-xs font-medium text-stone-500 uppercase tracking-wider">การชำระเงิน</p>
          {(folio.payments as Array<{ id: string; paidAt: string; paymentMethod: string; amount: number | string; status: string; referenceNo?: string | null }>).map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1">
              <div className="flex items-center gap-2 text-stone-400">
                <CreditCard className="h-3.5 w-3.5" />
                {PAYMENT_METHODS.find(m => m.value === p.paymentMethod)?.label || p.paymentMethod}
                {p.referenceNo && <span className="text-xs text-stone-600">#{p.referenceNo}</span>}
                <StatusBadge status={p.status} size="sm" />
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${p.status === 'voided' ? 'line-through text-stone-600' : 'text-emerald-300'}`}>{formatCurrency(Number(p.amount))}</span>
                {(p.status === 'paid' || p.status === 'partial_refunded') && isOpen && (
                  <>
                    <button onClick={() => {
                      const refunded = (p as { refunds?: Array<{ amount: number | string }> }).refunds?.reduce((s, r) => s + Number(r.amount), 0) || 0
                      const remaining = Number(p.amount) - refunded
                      setRefundPaymentId(p.id); setRefundAmount(String(remaining.toFixed(2))); setRefundReason('')
                    }}
                      className="text-xs text-violet-400 hover:text-violet-300 border border-violet-400/30 rounded-lg px-2 py-0.5 hover:bg-violet-400/10 transition-colors">
                      คืนเงิน
                    </button>
                    <button onClick={() => { setVoidPaymentId(p.id); setVoidReason('') }}
                      className="text-xs text-rose-400 hover:text-rose-300 border border-rose-400/30 rounded-lg px-2 py-0.5 hover:bg-rose-400/10 transition-colors">
                      Void
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deposits held */}
      {(folio?.deposits as Array<{ id: string; depositType: string; amount: number | string; status: string; paymentMethod: string }> || [])
        .filter((d) => d.status === 'held').length > 0 && (
        <div className="border-t border-white/10 p-4">
          <p className="mb-2 text-xs font-medium text-stone-500 uppercase tracking-wider">มัดจำที่ถืออยู่ (จะหักตอน Check-out)</p>
          {(folio.deposits as Array<{ id: string; depositType: string; amount: number | string; status: string; paymentMethod: string }>)
            .filter((d) => d.status === 'held')
            .map(d => {
              const typeLabel: Record<string, string> = { booking_deposit: 'มัดจำการจอง', keycard_deposit: 'มัดจำคีย์การ์ด', damage_deposit: 'มัดจำความเสียหาย' }
              const methodLabel: Record<string, string> = { cash: 'เงินสด', transfer: 'โอน', credit_card: 'บัตรเครดิต' }
              return (
                <div key={d.id} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2 text-stone-400">
                    <span className="text-amber-400/70">💰</span>
                    <span>{typeLabel[d.depositType] || d.depositType}</span>
                    <span className="text-xs text-stone-600">({methodLabel[d.paymentMethod] || d.paymentMethod})</span>
                    <span className="text-xs text-amber-400/60 border border-amber-300/20 rounded px-1">ถือไว้</span>
                  </div>
                  <span className="font-medium text-amber-300">{formatCurrency(Number(d.amount))}</span>
                </div>
              )
            })}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between text-stone-400"><span>ยอดรวม</span><span>{formatCurrency(summary.totalCharges)}</span></div>
            {summary.totalPayments > 0 && <div className="flex justify-between text-emerald-400"><span>ชำระแล้ว</span><span>-{formatCurrency(summary.totalPayments)}</span></div>}
            {summary.totalDepositsApplied > 0 && <div className="flex justify-between text-sky-400"><span>มัดจำที่ใช้แล้ว</span><span>-{formatCurrency(summary.totalDepositsApplied)}</span></div>}
            {summary.totalDepositsHeld > 0 && (
              <div className="flex justify-between text-amber-400/70 text-xs">
                <span>มัดจำที่ถือไว้ (จะหักตอน Check-out)</span>
                <span>-{formatCurrency(summary.totalDepositsHeld)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-2 font-semibold">
              <span className="text-stone-200">ยอดคงเหลือ</span>
              <span className={summary.balance > 0 ? 'text-amber-300' : 'text-emerald-300'}>{formatCurrency(summary.balance)}</span>
            </div>
            {summary.totalDepositsHeld > 0 && summary.balance > 0 && (
              <div className="flex justify-between text-xs text-emerald-400/80">
                <span>หลังหักมัดจำ</span>
                <span>{formatCurrency(summary.balanceAfterHeld || 0)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Charge Dialog */}
      <PmsDialog open={addChargeOpen} onClose={() => setAddChargeOpen(false)} title="เพิ่มรายการ" size="md">
        <div className="space-y-4">
          <Select value={chargeForm.itemType} onValueChange={v => setChargeForm(p => ({...p, itemType: v}))}>
            <SelectTrigger label="ประเภทรายการ"><SelectValue /></SelectTrigger>
            <SelectContent>{FOLIO_ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input label="รายละเอียด *" value={chargeForm.description} onChange={e => setChargeForm(p => ({...p, description: e.target.value}))} placeholder="รายละเอียดรายการ..." />
          <div className="grid grid-cols-3 gap-3">
            <Input label="จำนวน" type="number" value={chargeForm.quantity} onChange={e => setChargeForm(p => ({...p, quantity: e.target.value}))} min="1" />
            <Input label="ราคาต่อหน่วย (฿)" type="number" value={chargeForm.unitPrice} onChange={e => setChargeForm(p => ({...p, unitPrice: e.target.value}))} min="0" />
            <Input label="วันที่" type="date" value={chargeForm.serviceDate} onChange={e => setChargeForm(p => ({...p, serviceDate: e.target.value}))} />
          </div>
          {chargeForm.unitPrice && chargeForm.quantity && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-400/5 px-4 py-2 text-sm text-amber-200 text-right font-semibold">
              รวม: {formatCurrency(Number(chargeForm.quantity) * Number(chargeForm.unitPrice))}
            </div>
          )}
          <Button onClick={() => addChargeMutation.mutate()} loading={addChargeMutation.isPending} className="w-full" disabled={!chargeForm.description || !chargeForm.unitPrice}>
            เพิ่มรายการ
          </Button>
        </div>
      </PmsDialog>

      {/* Add Payment Dialog */}
      <PmsDialog open={addPaymentOpen} onClose={() => setAddPaymentOpen(false)} title="รับชำระเงิน" size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} onClick={() => setPaymentForm(p => ({...p, paymentMethod: m.value}))}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${paymentForm.paymentMethod === m.value ? 'border-amber-300/40 bg-amber-400/15 text-amber-200' : 'border-white/15 text-stone-400 hover:bg-white/[0.06]'}`}>
                <m.icon className="h-4 w-4" /> {m.label}
              </button>
            ))}
          </div>
          <Input label="จำนวนเงิน (฿) *" type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({...p, amount: e.target.value}))} min="0"
            placeholder={summary ? `ยอดคงเหลือ: ${formatCurrency(summary.balanceAfterHeld ?? summary.balance)}` : ''} />
          {['transfer', 'credit_card', 'ota'].includes(paymentForm.paymentMethod) && (
            <Input label="เลขอ้างอิง" value={paymentForm.referenceNo} onChange={e => setPaymentForm(p => ({...p, referenceNo: e.target.value}))} placeholder="เลขที่โอน / อนุมัติ..." />
          )}
          <Button onClick={() => addPaymentMutation.mutate()} loading={addPaymentMutation.isPending} className="w-full" disabled={!paymentForm.amount || Number(paymentForm.amount) <= 0}>
            รับชำระเงิน
          </Button>
        </div>
      </PmsDialog>

      {/* Add Discount Dialog */}
      <PmsDialog open={addDiscountOpen} onClose={() => setAddDiscountOpen(false)} title="เพิ่มส่วนลด" size="sm">
        <div className="space-y-4">
          <Input label="เหตุผลส่วนลด *" value={discountForm.description} onChange={e => setDiscountForm(p => ({...p, description: e.target.value}))} placeholder="เช่น ส่วนลดสมาชิก, โปรโมชั่น..." />
          <Input label="จำนวนส่วนลด (฿) *" type="number" value={discountForm.amount} onChange={e => setDiscountForm(p => ({...p, amount: e.target.value}))} min="0" />
          <Button onClick={() => addDiscountMutation.mutate()} loading={addDiscountMutation.isPending} className="w-full" disabled={!discountForm.description || !discountForm.amount}>
            เพิ่มส่วนลด
          </Button>
        </div>
      </PmsDialog>

      {/* Void Item Confirm */}
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

      {/* Void Payment Dialog */}
      <PmsDialog open={!!voidPaymentId} onClose={() => setVoidPaymentId(null)} title="Void การชำระเงิน" description="การ Void จะยกเลิกรายการนี้ ไม่สามารถย้อนกลับได้" size="sm">
        <div className="space-y-4">
          <Input label="เหตุผล *" value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="ระบุเหตุผล..." />
          <Button onClick={() => voidPaymentMutation.mutate()} loading={voidPaymentMutation.isPending} variant="destructive" className="w-full" disabled={!voidReason.trim()}>
            <Ban className="h-4 w-4" /> ยืนยัน Void
          </Button>
        </div>
      </PmsDialog>

      {/* Refund Payment Dialog */}
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
