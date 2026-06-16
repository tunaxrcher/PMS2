'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, BedDouble, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { roomsApi, roomTypesApi, zonesApi } from '@/lib/api'

interface RoomFormData {
  roomTypeId: string
  zoneId: string
  roomNumber: string
  roomName: string
  floorNo: string
  maxOccupancy: string
}

export default function RoomsSettingsPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRoom, setEditRoom] = useState<{ id: string } & RoomFormData | null>(null)
  const [form, setForm] = useState<RoomFormData>({ roomTypeId: '', zoneId: '', roomNumber: '', roomName: '', floorNo: '', maxOccupancy: '4' })

  const { data: rooms, isLoading } = useQuery({ queryKey: ['rooms'], queryFn: () => roomsApi.list().then(r => r.data) })
  const { data: roomTypes } = useQuery({ queryKey: ['room-types'], queryFn: () => roomTypesApi.list().then(r => r.data) })
  const { data: zones } = useQuery({ queryKey: ['zones-flat'], queryFn: () => zonesApi.flat().then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => roomsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setDialogOpen(false); toast.success('เพิ่มห้องพักสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => roomsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setDialogOpen(false); toast.success('แก้ไขสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => roomsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); toast.success('ปิดใช้งานห้องสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const handleSubmit = () => {
    if (!form.roomNumber || !form.roomTypeId) { toast.error('กรุณากรอกข้อมูลให้ครบ'); return }
    const payload = { roomTypeId: form.roomTypeId, zoneId: form.zoneId || undefined, roomNumber: form.roomNumber, roomName: form.roomName || undefined, floorNo: form.floorNo || undefined, maxOccupancy: Number(form.maxOccupancy) }
    if (editRoom) updateMutation.mutate({ id: editRoom.id, data: payload })
    else createMutation.mutate(payload)
  }

  const openCreate = () => { setEditRoom(null); setForm({ roomTypeId: '', zoneId: '', roomNumber: '', roomName: '', floorNo: '', maxOccupancy: '4' }); setDialogOpen(true) }
  const openEdit = (room: { id: string; roomTypeId: string; zoneId?: string | null; roomNumber: string; roomName?: string | null; floorNo?: string | null; maxOccupancy: number }) => {
    setEditRoom({ id: room.id, roomTypeId: room.roomTypeId, zoneId: room.zoneId || '', roomNumber: room.roomNumber, roomName: room.roomName || '', floorNo: room.floorNo || '', maxOccupancy: String(room.maxOccupancy) })
    setForm({ roomTypeId: room.roomTypeId, zoneId: room.zoneId || '', roomNumber: room.roomNumber, roomName: room.roomName || '', floorNo: room.floorNo || '', maxOccupancy: String(room.maxOccupancy) })
    setDialogOpen(true)
  }

  return (
    <AppShell title="ห้องพัก" subtitle="จัดการห้องพักทั้งหมดในที่พัก">
      <div className="space-y-5">
        <div className="flex justify-end">
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> เพิ่มห้องพัก</Button>
        </div>

        <GlassPanel dense padding="none">
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !rooms?.length ? (
            <EmptyState icon={BedDouble} title="ยังไม่มีห้องพัก" description="เพิ่มห้องพักเพื่อเริ่มต้นใช้งาน" action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> เพิ่มห้องพัก</Button>} className="m-4" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">หมายเลข</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ชื่อ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ประเภท</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">โซน</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">สถานะ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">จัดการ</th>
                </tr></thead>
                <tbody>
                  {(rooms as Array<{ id: string; roomNumber: string; roomName?: string | null; roomType: { name: string }; zone?: { name: string } | null; currentStatus: string; maxOccupancy: number; zoneId?: string | null; roomTypeId: string; floorNo?: string | null }>).map((room) => (
                    <tr key={room.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 font-mono text-amber-300">{room.roomNumber}</td>
                      <td className="px-4 py-3 text-stone-200">{room.roomName || '-'}</td>
                      <td className="px-4 py-3 text-stone-400">{room.roomType?.name}</td>
                      <td className="px-4 py-3 text-stone-400">{room.zone?.name || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={room.currentStatus} size="sm" /></td>
                      <td className="px-4 py-3 text-right flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(room)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => window.confirm(`ปิดใช้งานห้อง ${room.roomNumber} ใช่ไหม?`) && deleteMutation.mutate(room.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-400/10">
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

      <PmsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editRoom ? 'แก้ไขห้องพัก' : 'เพิ่มห้องพัก'} description={editRoom ? 'แก้ไขข้อมูลห้องพัก หมายเลข โซน และความจุ' : 'เพิ่มห้องพักใหม่ พร้อมกำหนดประเภท โซน และหมายเลขห้อง'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="หมายเลขห้อง *" value={form.roomNumber} onChange={e => setForm(p => ({...p, roomNumber: e.target.value}))} placeholder="101" />
            <Input label="ชื่อห้อง" value={form.roomName} onChange={e => setForm(p => ({...p, roomName: e.target.value}))} placeholder="Garden View 101" />
          </div>
          <Select value={form.roomTypeId} onValueChange={v => setForm(p => ({...p, roomTypeId: v}))}>
            <SelectTrigger label="ประเภทห้อง *"><SelectValue placeholder="เลือกประเภทห้อง" /></SelectTrigger>
            <SelectContent>{(roomTypes as Array<{ id: string; name: string }> || []).map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.zoneId} onValueChange={v => setForm(p => ({...p, zoneId: v}))}>
            <SelectTrigger label="โซน"><SelectValue placeholder="เลือกโซน (ไม่บังคับ)" /></SelectTrigger>
            <SelectContent>{(zones as Array<{ id: string; name: string }> || []).map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="ชั้น" value={form.floorNo} onChange={e => setForm(p => ({...p, floorNo: e.target.value}))} placeholder="1" />
            <Input label="ความจุสูงสุด" type="number" value={form.maxOccupancy} onChange={e => setForm(p => ({...p, maxOccupancy: e.target.value}))} min="1" max="20" />
          </div>
          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} className="w-full">
            {editRoom ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มห้องพัก'}
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
