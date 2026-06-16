'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Tag, Edit2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ratePlansApi, roomTypesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const MEAL_PLANS = [
  { value: 'none', label: 'ไม่รวมอาหาร' },
  { value: 'breakfast', label: 'รวมอาหารเช้า (BB)' },
  { value: 'half_board', label: 'Half Board (HB)' },
  { value: 'full_board', label: 'Full Board (FB)' },
]

interface PlanForm { roomTypeId: string; name: string; basePrice: string; mealPlan: string; cancellationPolicy: string }

export default function RatePlansPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dailyRateOpen, setDailyRateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<PlanForm>({ roomTypeId: '', name: '', basePrice: '0', mealPlan: 'none', cancellationPolicy: '' })
  const [dailyRateForm, setDailyRateForm] = useState({ roomTypeId: '', ratePlanId: '', date: '', price: '' })

  const { data: ratePlans, isLoading } = useQuery({ queryKey: ['rate-plans'], queryFn: () => ratePlansApi.list().then(r => r.data) })
  const { data: roomTypes } = useQuery({ queryKey: ['room-types'], queryFn: () => roomTypesApi.list().then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => ratePlansApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rate-plans'] }); setDialogOpen(false); toast.success('เพิ่ม Rate Plan สำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => ratePlansApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rate-plans'] }); setDialogOpen(false); toast.success('แก้ไขสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })
  const setDailyRateMutation = useMutation({
    mutationFn: () => ratePlansApi.setDailyRate({ roomTypeId: dailyRateForm.roomTypeId, ratePlanId: dailyRateForm.ratePlanId, date: dailyRateForm.date, price: Number(dailyRateForm.price) }),
    onSuccess: () => { setDailyRateOpen(false); toast.success('ตั้งราคาสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const handleSubmit = () => {
    if (!form.roomTypeId || !form.name) { toast.error('กรุณากรอกข้อมูลให้ครบ'); return }
    const payload = { roomTypeId: form.roomTypeId, name: form.name, basePrice: Number(form.basePrice), mealPlan: form.mealPlan, cancellationPolicy: form.cancellationPolicy || undefined }
    if (editId) updateMutation.mutate({ id: editId, data: payload })
    else createMutation.mutate(payload)
  }

  const openCreate = () => { setEditId(null); setForm({ roomTypeId: '', name: '', basePrice: '0', mealPlan: 'none', cancellationPolicy: '' }); setDialogOpen(true) }
  const openEdit = (p: { id: string; roomTypeId: string; name: string; basePrice: number | string; mealPlan: string; cancellationPolicy?: string | null }) => {
    setEditId(p.id); setForm({ roomTypeId: p.roomTypeId, name: p.name, basePrice: String(p.basePrice), mealPlan: p.mealPlan, cancellationPolicy: p.cancellationPolicy || '' }); setDialogOpen(true)
  }

  return (
    <AppShell title="Rate Plans" subtitle="กำหนดแผนราคาและนโยบายการจอง">
      <div className="space-y-5">
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setDailyRateOpen(true)}><Calendar className="h-4 w-4" /> ตั้งราคารายวัน</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> เพิ่ม Rate Plan</Button>
        </div>

        <GlassPanel dense padding="none">
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !(ratePlans as unknown[])?.length ? (
            <EmptyState icon={Tag} title="ยังไม่มี Rate Plan" action={<Button onClick={openCreate}><Plus className="h-4 w-4" />เพิ่ม</Button>} className="m-4" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ชื่อ Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ประเภทห้อง</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Meal Plan</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">ราคาฐาน</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">จัดการ</th>
                </tr></thead>
                <tbody>
                  {(ratePlans as Array<{ id: string; name: string; roomType: { name: string }; mealPlan: string; basePrice: number | string; roomTypeId: string; cancellationPolicy?: string | null }>).map(p => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-stone-200">{p.name}</td>
                      <td className="px-4 py-3 text-stone-400">{p.roomType?.name}</td>
                      <td className="px-4 py-3 text-stone-400">{MEAL_PLANS.find(m => m.value === p.mealPlan)?.label || p.mealPlan}</td>
                      <td className="px-4 py-3 text-right font-medium text-amber-300">{formatCurrency(Number(p.basePrice))}</td>
                      <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Edit2 className="h-3.5 w-3.5" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>
      </div>

      <PmsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editId ? 'แก้ไข Rate Plan' : 'เพิ่ม Rate Plan'} description={editId ? 'แก้ไขแผนราคาและนโยบายการยกเลิก' : 'กำหนดแผนราคา เช่น Best Available Rate, Breakfast Included'} size="md">
        <div className="space-y-4">
          <Select value={form.roomTypeId} onValueChange={v => setForm(p => ({...p, roomTypeId: v}))}>
            <SelectTrigger label="ประเภทห้อง *"><SelectValue placeholder="เลือก" /></SelectTrigger>
            <SelectContent>{(roomTypes as Array<{ id: string; name: string }> || []).map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input label="ชื่อ Rate Plan *" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="เช่น Best Available Rate, Walk-in..." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="ราคาฐาน (฿)" type="number" value={form.basePrice} onChange={e => setForm(p => ({...p, basePrice: e.target.value}))} min="0" />
            <Select value={form.mealPlan} onValueChange={v => setForm(p => ({...p, mealPlan: v}))}>
              <SelectTrigger label="Meal Plan"><SelectValue /></SelectTrigger>
              <SelectContent>{MEAL_PLANS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input label="นโยบายการยกเลิก" value={form.cancellationPolicy} onChange={e => setForm(p => ({...p, cancellationPolicy: e.target.value}))} placeholder="เช่น ยกเลิกได้ก่อน 3 วัน..." />
          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} className="w-full">
            {editId ? 'บันทึก' : 'เพิ่ม Rate Plan'}
          </Button>
        </div>
      </PmsDialog>

      {/* Daily Rate Dialog */}
      <PmsDialog open={dailyRateOpen} onClose={() => setDailyRateOpen(false)} title="ตั้งราคารายวัน" description="กำหนดราคาพิเศษสำหรับวันหรือช่วงเวลาเฉพาะ" size="md">
        <div className="space-y-4">
          <Select value={dailyRateForm.roomTypeId} onValueChange={v => setDailyRateForm(p => ({...p, roomTypeId: v, ratePlanId: ''}))}>
            <SelectTrigger label="ประเภทห้อง *"><SelectValue placeholder="เลือก" /></SelectTrigger>
            <SelectContent>{(roomTypes as Array<{ id: string; name: string }> || []).map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={dailyRateForm.ratePlanId} onValueChange={v => setDailyRateForm(p => ({...p, ratePlanId: v}))}>
            <SelectTrigger label="Rate Plan *"><SelectValue placeholder="เลือก" /></SelectTrigger>
            <SelectContent>
              {(ratePlans as Array<{ id: string; name: string; roomTypeId: string }> || [])
                .filter(p => !dailyRateForm.roomTypeId || p.roomTypeId === dailyRateForm.roomTypeId)
                .map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="วันที่ *" type="date" value={dailyRateForm.date} onChange={e => setDailyRateForm(p => ({...p, date: e.target.value}))} />
            <Input label="ราคา (฿) *" type="number" value={dailyRateForm.price} onChange={e => setDailyRateForm(p => ({...p, price: e.target.value}))} min="0" />
          </div>
          <Button onClick={() => setDailyRateMutation.mutate()} loading={setDailyRateMutation.isPending} className="w-full"
            disabled={!dailyRateForm.roomTypeId || !dailyRateForm.ratePlanId || !dailyRateForm.date || !dailyRateForm.price}>
            ตั้งราคา
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
