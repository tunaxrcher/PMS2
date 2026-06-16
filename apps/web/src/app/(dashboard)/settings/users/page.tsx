'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, Edit2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { usersApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const ROLES = [
  { value: 'admin', label: 'ผู้ดูแลระบบ' },
  { value: 'front_desk', label: 'พนักงานต้อนรับ' },
  { value: 'housekeeping', label: 'แม่บ้าน' },
]

interface UserForm { phone: string; firstName: string; lastName: string; roleName: string; active: boolean }

export default function UsersPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<UserForm>({ phone: '', firstName: '', lastName: '', roleName: 'front_desk', active: true })

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list().then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => usersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDialogOpen(false); toast.success('เพิ่มผู้ใช้งานสำเร็จ PIN เริ่มต้น: 000000') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDialogOpen(false); toast.success('แก้ไขสำเร็จ') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })
  const resetPinMutation = useMutation({
    mutationFn: (id: string) => usersApi.resetPin(id),
    onSuccess: () => toast.success('รีเซ็ต PIN สำเร็จ PIN ใหม่: 000000'),
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const handleSubmit = () => {
    if (!form.phone || !form.firstName || !form.lastName || !form.roleName) { toast.error('กรุณากรอกข้อมูลให้ครบ'); return }
    if (editId) updateMutation.mutate({ id: editId, data: { firstName: form.firstName, lastName: form.lastName, active: form.active, roleName: form.roleName } })
    else createMutation.mutate({ phone: form.phone, firstName: form.firstName, lastName: form.lastName, roleName: form.roleName })
  }

  const openCreate = () => { setEditId(null); setForm({ phone: '', firstName: '', lastName: '', roleName: 'front_desk', active: true }); setDialogOpen(true) }
  const openEdit = (u: { id: string; phone: string; firstName: string; lastName: string; roles: string[]; active: boolean }) => {
    setEditId(u.id); setForm({ phone: u.phone, firstName: u.firstName, lastName: u.lastName, roleName: u.roles[0] || 'front_desk', active: u.active }); setDialogOpen(true)
  }

  return (
    <AppShell title="ผู้ใช้งาน" subtitle="จัดการบัญชีพนักงาน">
      <div className="space-y-5">
        <div className="flex justify-end"><Button onClick={openCreate}><Plus className="h-4 w-4" /> เพิ่มผู้ใช้งาน</Button></div>
        <GlassPanel dense padding="none">
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !(users as unknown[])?.length ? (
            <EmptyState icon={Users} title="ยังไม่มีผู้ใช้งาน" action={<Button onClick={openCreate}><Plus className="h-4 w-4" />เพิ่ม</Button>} className="m-4" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ชื่อ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">เบอร์โทร</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Role</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-stone-500">สถานะ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">จัดการ</th>
                </tr></thead>
                <tbody>
                  {(users as Array<{ id: string; phone: string; firstName: string; lastName: string; roles: string[]; active: boolean; mustChangePinOnLogin: boolean }>).map(u => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3"><div className="font-medium text-stone-200">{u.firstName} {u.lastName}</div></td>
                      <td className="px-4 py-3 font-mono text-stone-400">{u.phone}</td>
                      <td className="px-4 py-3 text-stone-400">{ROLES.find(r => r.value === u.roles[0])?.label || u.roles[0]}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', u.active ? 'bg-emerald-400/15 text-emerald-300' : 'bg-stone-400/15 text-stone-400')}>
                          {u.active ? 'ใช้งาน' : 'ระงับ'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)} title="แก้ไข"><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => resetPinMutation.mutate(u.id)} title="รีเซ็ต PIN"><RefreshCw className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>
      </div>

      <PmsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editId ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'} description={editId ? 'แก้ไขข้อมูล Role และสถานะบัญชีพนักงาน' : 'สร้างบัญชีพนักงานใหม่ — PIN เริ่มต้น 000000 ต้องเปลี่ยนตอน Login ครั้งแรก'} size="md">
        <div className="space-y-4">
          {!editId && <Input label="เบอร์โทร *" type="tel" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="0XX-XXX-XXXX" />}
          <div className="grid grid-cols-2 gap-3">
            <Input label="ชื่อ *" value={form.firstName} onChange={e => setForm(p => ({...p, firstName: e.target.value}))} />
            <Input label="นามสกุล *" value={form.lastName} onChange={e => setForm(p => ({...p, lastName: e.target.value}))} />
          </div>
          <Select value={form.roleName} onValueChange={v => setForm(p => ({...p, roleName: v}))}>
            <SelectTrigger label="Role *"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
          {editId && (
            <Select value={form.active ? 'active' : 'inactive'} onValueChange={v => setForm(p => ({...p, active: v === 'active'}))}>
              <SelectTrigger label="สถานะ"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">ใช้งาน</SelectItem>
                <SelectItem value="inactive">ระงับการใช้งาน</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} className="w-full">
            {editId ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มผู้ใช้งาน'}
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
