'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wrench, Plus, CheckCircle2 } from 'lucide-react'
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
import { maintenanceApi, roomsApi } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function MaintenancePage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ roomId: '', issueTitle: '', issueDetail: '', priority: 'medium' })

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['maintenance', statusFilter],
    queryFn: () => maintenanceApi.list({ status: statusFilter || undefined }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsApi.list().then(r => r.data),
    enabled: createOpen,
  })

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => maintenanceApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); setCreateOpen(false); toast.success('สร้างใบแจ้งซ่อมสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const resolveMutation = useMutation({
    mutationFn: (id: string) => maintenanceApi.resolve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); toast.success('แก้ไขปัญหาสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const priorityColor: Record<string, string> = {
    low: 'border-stone-300/20 bg-stone-400/5',
    medium: 'border-amber-300/20 bg-amber-400/5',
    high: 'border-orange-300/20 bg-orange-400/5',
    urgent: 'border-rose-300/20 bg-rose-400/5',
  }

  return (
    <AppShell
      title="แจ้งซ่อม"
      subtitle="ติดตามและจัดการงานซ่อมบำรุง"
      headerActions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> แจ้งซ่อม</Button>}
    >
      <div className="space-y-5">
        <div className="flex gap-2">
          {[{ value: '', label: 'ทั้งหมด' }, { value: 'open', label: 'เปิด' }, { value: 'in_progress', label: 'กำลังดำเนินการ' }, { value: 'resolved', label: 'แก้ไขแล้ว' }].map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              className={cn('rounded-xl px-3 py-1.5 text-xs font-medium transition-colors', statusFilter === s.value ? 'bg-amber-400/15 text-amber-200 border border-amber-300/20' : 'text-stone-500 hover:text-stone-300 border border-transparent')}>
              {s.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : !(tickets as unknown[])?.length ? (
          <EmptyState icon={Wrench} title="ไม่มีรายการแจ้งซ่อม" description="ไม่มีปัญหาที่รอการแก้ไข" action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> แจ้งซ่อม</Button>} />
        ) : (
          <div className="space-y-3">
            {(tickets as Array<{
              id: string; issueTitle: string; issueDetail?: string | null; priority: string; status: string
              createdAt: string; resolvedAt?: string | null
              room?: { roomNumber: string; zone?: { name: string } | null } | null
            }>).map(ticket => (
              <div key={ticket.id} className={cn('rounded-2xl border p-4 backdrop-blur-xl', priorityColor[ticket.priority] || priorityColor.medium)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {ticket.room && <span className="text-sm font-mono font-semibold text-amber-300">ห้อง {ticket.room.roomNumber}</span>}
                      <StatusBadge status={ticket.priority === 'urgent' ? 'urgent' : ticket.priority === 'high' ? 'high' : ticket.priority === 'medium' ? 'medium' : 'low'} size="sm" />
                      <StatusBadge status={ticket.status === 'open' ? 'open_ticket' : ticket.status === 'resolved' ? 'resolved' : ticket.status} size="sm" />
                    </div>
                    <div className="font-medium text-stone-200">{ticket.issueTitle}</div>
                    {ticket.issueDetail && <div className="text-xs text-stone-500 mt-1">{ticket.issueDetail}</div>}
                    <div className="text-[11px] text-stone-600 mt-1">{formatDateTime(ticket.createdAt)}</div>
                  </div>
                  {['open', 'in_progress'].includes(ticket.status) && (
                    <Button size="sm" variant="secondary" onClick={() => resolveMutation.mutate(ticket.id)} loading={resolveMutation.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> แก้ไขแล้ว
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PmsDialog open={createOpen} onClose={() => setCreateOpen(false)} title="แจ้งซ่อม" size="md">
        <div className="space-y-4">
          <Select value={form.roomId} onValueChange={v => setForm(p => ({...p, roomId: v}))}>
            <SelectTrigger label="ห้อง (ถ้ามี)"><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">ไม่เฉพาะห้อง</SelectItem>
              {(rooms as Array<{ id: string; roomNumber: string }> || []).map(r => <SelectItem key={r.id} value={r.id}>{r.roomNumber}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input label="หัวข้อปัญหา *" value={form.issueTitle} onChange={e => setForm(p => ({...p, issueTitle: e.target.value}))} placeholder="เช่น แอร์ไม่ทำงาน, น้ำรั่ว..." />
          <Input label="รายละเอียด" value={form.issueDetail} onChange={e => setForm(p => ({...p, issueDetail: e.target.value}))} placeholder="รายละเอียดเพิ่มเติม..." />
          <Select value={form.priority} onValueChange={v => setForm(p => ({...p, priority: v}))}>
            <SelectTrigger label="ความเร่งด่วน"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">ต่ำ</SelectItem>
              <SelectItem value="medium">ปานกลาง</SelectItem>
              <SelectItem value="high">สูง</SelectItem>
              <SelectItem value="urgent">ด่วนมาก</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => form.issueTitle && createMutation.mutate({ roomId: form.roomId || undefined, issueTitle: form.issueTitle, issueDetail: form.issueDetail || undefined, priority: form.priority })} loading={createMutation.isPending} className="w-full" disabled={!form.issueTitle}>
            แจ้งซ่อม
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
