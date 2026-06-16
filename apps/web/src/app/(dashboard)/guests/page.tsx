'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, Search, Phone, Mail, AlertTriangle, User } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { guestsApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface GuestForm {
  firstName: string; lastName: string; phone: string; email: string
  nationality: string; idType: string; idNumber: string; address: string; remark: string
}

const defaultForm: GuestForm = { firstName: '', lastName: '', phone: '', email: '', nationality: '', idType: '', idNumber: '', address: '', remark: '' }

export default function GuestsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<GuestForm>(defaultForm)

  const { data, isLoading } = useQuery({
    queryKey: ['guests', page, search],
    queryFn: () => {
      if (search.length >= 2) return guestsApi.search(search).then(r => ({ guests: r.data, total: r.data.length, page: 1, limit: 20 }))
      return guestsApi.list({ page, limit: 20 }).then(r => r.data)
    },
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => guestsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); setDialogOpen(false); toast.success('เพิ่มลูกค้าสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => guestsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); setDialogOpen(false); toast.success('แก้ไขสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const handleSubmit = () => {
    if (!form.firstName || !form.lastName) { toast.error('กรุณาระบุชื่อและนามสกุล'); return }
    const payload = { firstName: form.firstName, lastName: form.lastName, phone: form.phone || undefined, email: form.email || undefined, nationality: form.nationality || undefined, idType: form.idType || undefined, idNumber: form.idNumber || undefined, address: form.address || undefined, remark: form.remark || undefined }
    if (editId) updateMutation.mutate({ id: editId, data: payload })
    else createMutation.mutate(payload)
  }

  const openEdit = (g: { id: string; firstName: string; lastName: string; phone?: string | null; email?: string | null; nationality?: string | null; idType?: string | null; idNumber?: string | null; address?: string | null; remark?: string | null }) => {
    setEditId(g.id); setForm({ firstName: g.firstName, lastName: g.lastName, phone: g.phone || '', email: g.email || '', nationality: g.nationality || '', idType: g.idType || '', idNumber: g.idNumber || '', address: g.address || '', remark: g.remark || '' }); setDialogOpen(true)
  }

  return (
    <AppShell title="ลูกค้า" subtitle="ฐานข้อมูลลูกค้าทั้งหมด">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="ค้นหาชื่อ เบอร์โทร..."
              className="h-9 w-full rounded-full border border-white/15 bg-black/25 pl-9 pr-4 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-300/40 focus:outline-none backdrop-blur-sm"
            />
          </div>
          <Button onClick={() => { setEditId(null); setForm(defaultForm); setDialogOpen(true) }}><Plus className="h-4 w-4" /> เพิ่มลูกค้า</Button>
        </div>

        <GlassPanel dense padding="none">
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : !data?.guests?.length ? (
            <EmptyState icon={Users} title="ไม่พบลูกค้า" description={search ? `ไม่พบลูกค้าที่ค้นหา "${search}"` : 'ยังไม่มีข้อมูลลูกค้า'} className="m-4" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ชื่อ-นามสกุล</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">ติดต่อ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">สัญชาติ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">จัดการ</th>
                </tr></thead>
                <tbody>
                  {(data.guests as Array<{ id: string; firstName: string; lastName: string; phone?: string | null; email?: string | null; nationality?: string | null; idType?: string | null; idNumber?: string | null; address?: string | null; remark?: string | null; blacklistFlag: boolean }>).map(g => (
                    <tr key={g.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-stone-200">{g.firstName} {g.lastName}</span>
                          {g.blacklistFlag && <AlertTriangle className="h-3.5 w-3.5 text-rose-400" title="Blacklist" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {g.phone && <div className="flex items-center gap-1 text-stone-400 text-xs"><Phone className="h-3 w-3" /> {g.phone}</div>}
                        {g.email && <div className="flex items-center gap-1 text-stone-500 text-xs"><Mail className="h-3 w-3" /> {g.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-stone-400">{g.nationality || '-'}</td>
                      <td className="px-4 py-3 text-right flex justify-end gap-1">
                        <Link href={`/guests/${g.id}`}>
                          <Button variant="ghost" size="sm" title="ดูโปรไฟล์"><User className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>แก้ไข</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>

        {data && data.total > data.limit && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← ก่อนหน้า</Button>
            <span className="text-sm text-stone-400">หน้า {page}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total}>ถัดไป →</Button>
          </div>
        )}
      </div>

      <PmsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editId ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'} description={editId ? 'แก้ไขข้อมูลส่วนตัวและข้อมูลบัตรของลูกค้า' : 'บันทึกข้อมูลลูกค้าใหม่สำหรับการจองครั้งนี้และครั้งต่อไป'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="ชื่อ *" value={form.firstName} onChange={e => setForm(p => ({...p, firstName: e.target.value}))} />
            <Input label="นามสกุล *" value={form.lastName} onChange={e => setForm(p => ({...p, lastName: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="เบอร์โทร" type="tel" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} />
            <Input label="อีเมล" type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="สัญชาติ" value={form.nationality} onChange={e => setForm(p => ({...p, nationality: e.target.value}))} placeholder="ไทย" />
            <Select value={form.idType} onValueChange={v => setForm(p => ({...p, idType: v}))}>
              <SelectTrigger label="ประเภทบัตร"><SelectValue placeholder="เลือก" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="citizen_id">บัตรประชาชน</SelectItem>
                <SelectItem value="passport">พาสปอร์ต</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.idType && <Input label="หมายเลขบัตร" value={form.idNumber} onChange={e => setForm(p => ({...p, idNumber: e.target.value}))} placeholder="x-xxxx-xxxxx-xx-x" />}
          <Input label="ที่อยู่" value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))} />
          <Input label="หมายเหตุ" value={form.remark} onChange={e => setForm(p => ({...p, remark: e.target.value}))} />
          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} className="w-full">
            {editId ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มลูกค้า'}
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
