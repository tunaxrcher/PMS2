'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { zonesApi } from '@/lib/api'
import { ImageUpload } from '@/components/ui/image-upload'

const ZONE_TYPES = [
  { value: 'building', label: 'อาคาร' },
  { value: 'floor', label: 'ชั้น' },
  { value: 'wing', label: 'ปีก' },
  { value: 'villa_zone', label: 'โซนวิลล่า' },
  { value: 'beach_zone', label: 'โซนชายหาด' },
  { value: 'pool_zone', label: 'โซนสระน้ำ' },
  { value: 'garden_zone', label: 'โซนสวน' },
  { value: 'other', label: 'อื่นๆ' },
]

interface ZoneForm { name: string; zoneType: string; parentZoneId: string; sortOrder: string; imageUrl: string }

export default function ZonesPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ZoneForm>({ name: '', zoneType: 'other', parentZoneId: '', sortOrder: '0' })

  const { data: zones, isLoading } = useQuery({ queryKey: ['zones-flat'], queryFn: () => zonesApi.flat().then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => zonesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-flat'] }); setDialogOpen(false); toast.success('เพิ่มโซนสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => zonesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-flat'] }); setDialogOpen(false); toast.success('แก้ไขสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => zonesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-flat'] }); toast.success('ลบโซนสำเร็จ') },
    onError: () => toast.error('ไม่สามารถลบโซนที่มีห้องพักอยู่ได้'),
  })

  const handleSubmit = () => {
    if (!form.name) { toast.error('กรุณาระบุชื่อโซน'); return }
    const payload = { name: form.name, zoneType: form.zoneType, parentZoneId: form.parentZoneId || undefined, sortOrder: Number(form.sortOrder), imageUrl: form.imageUrl || undefined }
    if (editId) updateMutation.mutate({ id: editId, data: payload })
    else createMutation.mutate(payload)
  }

  const openCreate = () => { setEditId(null); setForm({ name: '', zoneType: 'other', parentZoneId: '', sortOrder: '0', imageUrl: '' }); setDialogOpen(true) }

  return (
    <AppShell title="โซน" subtitle="จัดการพื้นที่และโซนของที่พัก">
      <div className="space-y-5">
        <div className="flex justify-end"><Button onClick={openCreate}><Plus className="h-4 w-4" /> เพิ่มโซน</Button></div>
        <GlassPanel dense padding="none">
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !(zones as unknown[])?.length ? (
            <EmptyState icon={MapPin} title="ยังไม่มีโซน" action={<Button onClick={openCreate}><Plus className="h-4 w-4" />เพิ่ม</Button>} className="m-4" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ชื่อโซน</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ประเภท</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">จัดการ</th>
                </tr></thead>
                <tbody>
                  {(zones as Array<{ id: string; name: string; zoneType: string; sortOrder: number; parentZoneId?: string | null }>).map(z => (
                    <tr key={z.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-stone-200">{z.name}</td>
                      <td className="px-4 py-3 text-stone-400">{ZONE_TYPES.find(t => t.value === z.zoneType)?.label || z.zoneType}</td>
                      <td className="px-4 py-3 text-right flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditId(z.id); setForm({ name: z.name, zoneType: z.zoneType, parentZoneId: z.parentZoneId || '', sortOrder: String(z.sortOrder), imageUrl: (z as { imageUrl?: string }).imageUrl || '' }); setDialogOpen(true) }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => window.confirm(`ลบโซน "${z.name}" ใช่ไหม?`) && deleteMutation.mutate(z.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-400/10">
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

      <PmsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editId ? 'แก้ไขโซน' : 'เพิ่มโซน'} description={editId ? 'แก้ไขรายละเอียดของโซนนี้' : 'กำหนดพื้นที่หรือโซนของที่พัก เช่น Beach Zone, Garden Zone'} size="md">
        <div className="space-y-4">
          <Input label="ชื่อโซน *" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Beach Zone" />
          <ImageUpload label="รูปภาพโซน" value={form.imageUrl} onChange={url => setForm(p => ({...p, imageUrl: url}))} onRemove={() => setForm(p => ({...p, imageUrl: ''}))} placeholder="รูปแทนโซนนี้" />
          <Select value={form.zoneType} onValueChange={v => setForm(p => ({...p, zoneType: v}))}>
            <SelectTrigger label="ประเภทโซน"><SelectValue /></SelectTrigger>
            <SelectContent>{ZONE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.parentZoneId || 'none'} onValueChange={v => setForm(p => ({...p, parentZoneId: v === 'none' ? '' : v}))}>
            <SelectTrigger label="โซนแม่ (ถ้ามี)"><SelectValue placeholder="ไม่มี" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ไม่มี (Root)</SelectItem>
              {(zones as Array<{ id: string; name: string }> || []).filter(z => z.id !== editId).map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input label="ลำดับ" type="number" value={form.sortOrder} onChange={e => setForm(p => ({...p, sortOrder: e.target.value}))} min="0" />
          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} className="w-full">
            {editId ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มโซน'}
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
