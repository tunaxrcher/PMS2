'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Play, CheckCircle, AlertTriangle, Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { housekeepingApi, roomsApi } from '@/lib/api'
import { cn, formatDateTime } from '@/lib/utils'

const STATUS_TABS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอดำเนินการ' },
  { value: 'in_progress', label: 'กำลังทำ' },
  { value: 'done', label: 'เสร็จแล้ว' },
]

export default function HousekeepingPage() {
  const qc = useQueryClient()
  const [statusTab, setStatusTab] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [remarksDialog, setRemarksDialog] = useState<{ taskId: string; action: 'complete' } | null>(null)
  const [startConfirm, setStartConfirm] = useState<string | null>(null)
  const [remark, setRemark] = useState('')
  const [newTaskForm, setNewTaskForm] = useState({ roomId: '', taskType: 'stayover_cleaning', assignedTo: '' })

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['housekeeping', statusTab],
    queryFn: () => housekeepingApi.tasks({ status: statusTab || undefined }).then(r => r.data),
    refetchInterval: 10_000,
  })

  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsApi.list().then(r => r.data),
    enabled: createOpen,
  })

  const startMutation = useMutation({
    mutationFn: (id: string) => housekeepingApi.start(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['housekeeping'] }); toast.success('เริ่มทำความสะอาดแล้ว') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const completeMutation = useMutation({
    mutationFn: ({ id, remark }: { id: string; remark?: string }) => housekeepingApi.complete(id, remark),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['housekeeping'] }); setRemarksDialog(null); setRemark(''); toast.success('ทำความสะอาดเสร็จแล้ว ห้องพร้อมใช้งาน') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => housekeepingApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['housekeeping'] }); setCreateOpen(false); toast.success('สร้างงานสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const taskTypeLabel: Record<string, string> = {
    checkout_cleaning: 'ทำความสะอาดหลัง Check-out',
    stayover_cleaning: 'ทำความสะอาดระหว่างพัก',
    deep_cleaning: 'ทำความสะอาดใหญ่',
  }

  return (
    <AppShell
      title="แม่บ้าน"
      subtitle="จัดการงานทำความสะอาดห้องพัก"
      headerActions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> สร้างงาน</Button>}
    >
      <div className="space-y-5">
        {/* Status tabs */}
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all', statusTab === tab.value ? 'bg-amber-400/15 text-amber-200 border border-amber-300/20' : 'text-stone-500 hover:text-stone-300')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : !(tasks as unknown[])?.length ? (
          <EmptyState icon={Sparkles} title="ไม่มีงานทำความสะอาด" description="ทุกห้องสะอาดและพร้อมบริการ" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(tasks as Array<{
              id: string
              taskType: string
              status: string
              startedAt?: string | null
              completedAt?: string | null
              remark?: string | null
              room: { roomNumber: string; roomType: { name: string }; zone?: { name: string } | null; currentStatus: string }
            }>).map(task => (
              <div key={task.id} className={cn('rounded-2xl border p-4 backdrop-blur-xl transition-all', {
                'border-amber-300/20 bg-amber-400/[0.07]': task.status === 'pending',
                'border-sky-300/20 bg-sky-400/[0.07]': task.status === 'in_progress',
                'border-emerald-300/20 bg-emerald-400/[0.07]': task.status === 'done',
              })}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="text-lg font-bold text-stone-100">ห้อง {task.room.roomNumber}</div>
                    <div className="text-xs text-stone-500">{task.room.zone?.name || task.room.roomType.name}</div>
                  </div>
                  <StatusBadge status={task.status} size="sm" />
                </div>

                <div className="mb-3 text-xs text-stone-400">{taskTypeLabel[task.taskType] || task.taskType}</div>

                {task.startedAt && <div className="mb-1 text-[11px] text-stone-500">เริ่ม: {formatDateTime(task.startedAt)}</div>}
                {task.completedAt && <div className="mb-1 text-[11px] text-emerald-500">เสร็จ: {formatDateTime(task.completedAt)}</div>}

                <div className="flex gap-2 mt-3">
                  {task.status === 'pending' && (
                    <Button size="sm" className="flex-1 h-10 text-xs" onClick={() => setStartConfirm(task.id)} loading={startMutation.isPending}>
                      <Play className="h-3.5 w-3.5" /> เริ่มทำ
                    </Button>
                  )}
                  {task.status === 'in_progress' && (
                    <Button size="sm" variant="default" className="flex-1 h-10 text-xs bg-emerald-500 hover:bg-emerald-400" onClick={() => setRemarksDialog({ taskId: task.id, action: 'complete' })}>
                      <CheckCircle className="h-3.5 w-3.5" /> เสร็จแล้ว
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Start Confirm */}
      <ConfirmDialog
        open={!!startConfirm}
        onClose={() => setStartConfirm(null)}
        onConfirm={() => { startMutation.mutate(startConfirm!); setStartConfirm(null) }}
        title="เริ่มทำความสะอาด"
        description="ยืนยันการเริ่มทำความสะอาดห้องนี้?"
        confirmLabel="✓ เริ่มทำเลย"
        variant="success"
        loading={startMutation.isPending}
      />

      {/* Complete dialog */}
      <PmsDialog open={!!remarksDialog} onClose={() => setRemarksDialog(null)} title="ทำความสะอาดเสร็จแล้ว" description="ห้องจะถูกเปลี่ยนสถานะเป็น สะอาด และพร้อมเปิดขายอีกครั้ง" size="md">
        <div className="space-y-4">
          <Input label="หมายเหตุ (ไม่บังคับ)" value={remark} onChange={e => setRemark(e.target.value)} placeholder="เช่น เติมผ้าเช็ดตัวเพิ่ม..." />
          <Button
            onClick={() => remarksDialog && completeMutation.mutate({ id: remarksDialog.taskId, remark: remark || undefined })}
            loading={completeMutation.isPending}
            className="w-full bg-emerald-500 hover:bg-emerald-400"
          >
            <CheckCircle className="h-4 w-4" /> ยืนยัน เสร็จแล้ว
          </Button>
        </div>
      </PmsDialog>

      {/* Create task dialog */}
      <PmsDialog open={createOpen} onClose={() => setCreateOpen(false)} title="สร้างงานทำความสะอาด" size="md">
        <div className="space-y-4">
          <Select value={newTaskForm.roomId} onValueChange={v => setNewTaskForm(p => ({...p, roomId: v}))}>
            <SelectTrigger label="ห้อง *"><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
            <SelectContent>
              {(rooms as Array<{ id: string; roomNumber: string; roomName?: string | null }> || []).map(r => <SelectItem key={r.id} value={r.id}>{r.roomNumber} {r.roomName ? `(${r.roomName})` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={newTaskForm.taskType} onValueChange={v => setNewTaskForm(p => ({...p, taskType: v}))}>
            <SelectTrigger label="ประเภทงาน"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stayover_cleaning">ทำความสะอาดระหว่างพัก</SelectItem>
              <SelectItem value="checkout_cleaning">ทำความสะอาดหลัง Check-out</SelectItem>
              <SelectItem value="deep_cleaning">ทำความสะอาดใหญ่</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => newTaskForm.roomId && createMutation.mutate(newTaskForm)} loading={createMutation.isPending} className="w-full" disabled={!newTaskForm.roomId}>
            สร้างงาน
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
