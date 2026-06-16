'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Ticket, Edit2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { bookingsApi, api } from '@/lib/api'
import { cn } from '@/lib/utils'

const SOURCE_TYPES = [
  { value: 'direct', label: 'Direct (ตรง)' },
  { value: 'ota', label: 'OTA (Agoda, Booking.com...)' },
  { value: 'agent', label: 'Agent / Tour' },
  { value: 'corporate', label: 'Corporate' },
]

interface SourceForm { name: string; sourceType: string; active: boolean }

export default function BookingSourcesPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<SourceForm>({ name: '', sourceType: 'direct', active: true })

  const { data: sources, isLoading } = useQuery({
    queryKey: ['booking-sources-all'],
    queryFn: () => bookingsApi.sources().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/bookings/sources', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking-sources-all'] }); qc.invalidateQueries({ queryKey: ['booking-sources'] }); setDialogOpen(false); toast.success('เพิ่มช่องทางสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/bookings/sources/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booking-sources-all'] }); setDialogOpen(false); toast.success('แก้ไขสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const handleSubmit = () => {
    if (!form.name) { toast.error('กรุณาระบุชื่อช่องทาง'); return }
    if (editId) updateMutation.mutate({ id: editId, data: form })
    else createMutation.mutate(form)
  }

  const openCreate = () => { setEditId(null); setForm({ name: '', sourceType: 'direct', active: true }); setDialogOpen(true) }
  const openEdit = (s: { id: string; name: string; sourceType: string; active: boolean }) => {
    setEditId(s.id); setForm({ name: s.name, sourceType: s.sourceType, active: s.active }); setDialogOpen(true)
  }

  return (
    <AppShell title="ช่องทางการจอง" subtitle="Walk-in, OTA, Direct, Agent">
      <div className="space-y-5">
        <div className="flex justify-end"><Button onClick={openCreate}><Plus className="h-4 w-4" /> เพิ่มช่องทาง</Button></div>
        <GlassPanel dense padding="none">
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !(sources as unknown[])?.length ? (
            <EmptyState icon={Ticket} title="ยังไม่มีช่องทาง" action={<Button onClick={openCreate}><Plus className="h-4 w-4" />เพิ่ม</Button>} className="m-4" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ชื่อ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ประเภท</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-stone-500">สถานะ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">จัดการ</th>
                </tr></thead>
                <tbody>
                  {(sources as Array<{ id: string; name: string; sourceType: string; active: boolean }>).map(s => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-stone-200">{s.name}</td>
                      <td className="px-4 py-3 text-stone-400">{SOURCE_TYPES.find(t => t.value === s.sourceType)?.label || s.sourceType}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', s.active ? 'bg-emerald-400/15 text-emerald-300' : 'bg-stone-400/15 text-stone-400')}>
                          {s.active ? 'ใช้งาน' : 'ปิด'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>
      </div>

      <PmsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editId ? 'แก้ไขช่องทาง' : 'เพิ่มช่องทางการจอง'} size="sm">
        <div className="space-y-4">
          <Input label="ชื่อช่องทาง *" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="เช่น Walk-in, Line OA, Agoda..." />
          <Select value={form.sourceType} onValueChange={v => setForm(p => ({...p, sourceType: v}))}>
            <SelectTrigger label="ประเภท"><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          {editId && (
            <Select value={form.active ? 'active' : 'inactive'} onValueChange={v => setForm(p => ({...p, active: v === 'active'}))}>
              <SelectTrigger label="สถานะ"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">ใช้งาน</SelectItem>
                <SelectItem value="inactive">ปิด</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} className="w-full">
            {editId ? 'บันทึก' : 'เพิ่มช่องทาง'}
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
