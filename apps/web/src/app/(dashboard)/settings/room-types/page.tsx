'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Layers, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { roomTypesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { ImageUpload } from '@/components/ui/image-upload'

interface RoomTypeForm { name: string; description: string; imageUrl: string; baseOccupancy: string; maxOccupancy: string; baseRate: string }

export default function RoomTypesPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<RoomTypeForm>({ name: '', description: '', imageUrl: '', baseOccupancy: '2', maxOccupancy: '4', baseRate: '0' })

  const { data: roomTypes, isLoading } = useQuery({ queryKey: ['room-types'], queryFn: () => roomTypesApi.list().then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => roomTypesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-types'] }); setDialogOpen(false); toast.success('เพิ่มประเภทห้องสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => roomTypesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-types'] }); setDialogOpen(false); toast.success('แก้ไขสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => roomTypesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-types'] }); toast.success('ลบประเภทห้องสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'ไม่สามารถลบได้'),
  })

  const handleSubmit = () => {
    if (!form.name) { toast.error('กรุณาระบุชื่อประเภทห้อง'); return }
    const payload = { name: form.name, description: form.description || undefined, imageUrl: form.imageUrl || undefined, baseOccupancy: Number(form.baseOccupancy), maxOccupancy: Number(form.maxOccupancy), baseRate: Number(form.baseRate) }
    if (editId) updateMutation.mutate({ id: editId, data: payload })
    else createMutation.mutate(payload)
  }

  const openCreate = () => { setEditId(null); setForm({ name: '', description: '', imageUrl: '', baseOccupancy: '2', maxOccupancy: '4', baseRate: '0' }); setDialogOpen(true) }
  const openEdit = (rt: { id: string; name: string; description?: string | null; imageUrl?: string | null; baseOccupancy: number; maxOccupancy: number; baseRate: number | string }) => {
    setEditId(rt.id)
    setForm({ name: rt.name, description: rt.description || '', imageUrl: rt.imageUrl || '', baseOccupancy: String(rt.baseOccupancy), maxOccupancy: String(rt.maxOccupancy), baseRate: String(rt.baseRate) })
    setDialogOpen(true)
  }

  return (
    <AppShell title="ประเภทห้อง" subtitle="กำหนดประเภทและราคาห้องพัก">
      <div className="space-y-5">
        <div className="flex justify-end"><Button onClick={openCreate}><Plus className="h-4 w-4" /> เพิ่มประเภทห้อง</Button></div>
        <GlassPanel dense padding="none">
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !(roomTypes as unknown[])?.length ? (
            <EmptyState icon={Layers} title="ยังไม่มีประเภทห้อง" action={<Button onClick={openCreate}><Plus className="h-4 w-4" />เพิ่ม</Button>} className="m-4" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ประเภทห้อง</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">รองรับ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">ราคาเริ่มต้น</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">จัดการ</th>
                </tr></thead>
                <tbody>
                  {(roomTypes as Array<{ id: string; name: string; description?: string | null; imageUrl?: string | null; baseOccupancy: number; maxOccupancy: number; baseRate: number | string }>).map(rt => (
                    <tr key={rt.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {rt.imageUrl && <img src={rt.imageUrl} alt={rt.name} className="h-9 w-14 rounded-lg object-cover border border-white/10 flex-shrink-0" />}
                        <div><div className="font-medium text-stone-200">{rt.name}</div><div className="text-xs text-stone-500">{rt.description}</div></div>
                      </div>
                    </td>
                      <td className="px-4 py-3 text-stone-400">{rt.baseOccupancy}–{rt.maxOccupancy} คน</td>
                      <td className="px-4 py-3 text-right font-medium text-amber-300">{formatCurrency(Number(rt.baseRate))}</td>
                      <td className="px-4 py-3 text-right flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(rt)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => window.confirm(`ลบ "${rt.name}" ใช่ไหม?`) && deleteMutation.mutate(rt.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-400/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>
      </div>

      <PmsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editId ? 'แก้ไขประเภทห้อง' : 'เพิ่มประเภทห้อง'} description={editId ? 'แก้ไขรายละเอียดประเภทห้อง ราคา และรูปภาพ' : 'กำหนดประเภทห้อง เช่น Deluxe Room, Pool Villa พร้อมราคาและรูปภาพตัวอย่าง'} size="lg">
        <div className="space-y-4">
          <Input label="ชื่อประเภทห้อง *" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Deluxe Room" />
          <Input label="รายละเอียด" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="ห้อง Deluxe วิวสระว่ายน้ำ" />
          <ImageUpload
            label="รูปภาพตัวอย่าง"
            value={form.imageUrl}
            onChange={url => setForm(p => ({...p, imageUrl: url}))}
            onRemove={() => setForm(p => ({...p, imageUrl: ''}))}
            placeholder="รูปประเภทห้อง"
            aspectRatio="wide"
          />
          <div className="grid grid-cols-3 gap-3">
            <Input label="ความจุปกติ" type="number" value={form.baseOccupancy} onChange={e => setForm(p => ({...p, baseOccupancy: e.target.value}))} min="1" />
            <Input label="ความจุสูงสุด" type="number" value={form.maxOccupancy} onChange={e => setForm(p => ({...p, maxOccupancy: e.target.value}))} min="1" />
            <Input label="ราคาเริ่มต้น (฿)" type="number" value={form.baseRate} onChange={e => setForm(p => ({...p, baseRate: e.target.value}))} min="0" />
          </div>
          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} className="w-full">
            {editId ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มประเภทห้อง'}
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
