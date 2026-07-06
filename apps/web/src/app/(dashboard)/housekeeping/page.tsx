'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles, Play, CheckCircle, Plus, Clock, AlertTriangle,
  LogOut, Brush, ArrowRightLeft, User,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RoomPicker } from '@/components/ui/room-picker'
import { housekeepingApi, roomsApi, usersApi } from '@/lib/api'
import { cn, formatDateTime } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────
interface HkTask {
  id: string
  taskType: string
  status: string
  assignedTo?: string | null
  startedAt?: string | null
  completedAt?: string | null
  remark?: string | null
  createdAt: string
  roomId: string
  room: {
    id: string
    roomNumber: string
    currentStatus: string
    roomType: { name: string }
    zone?: { name: string } | null
    arrivalToday?: { guestName: string; readyBy: string } | null
  }
}

interface RoomLite {
  id: string; roomNumber: string; roomName?: string | null; currentStatus: string
  roomType?: { name: string } | null
  zone?: { name: string } | null
}

interface UserLite { id: string; firstName: string; lastName: string }

// ── Task-type visual config ──────────────────────────────
const TASK_TYPE: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  checkout_cleaning:   { label: 'หลังเช็คเอาท์', icon: LogOut,         color: 'text-amber-300' },
  stayover_cleaning:   { label: 'ระหว่างพัก',    icon: Brush,          color: 'text-sky-300' },
  deep_cleaning:       { label: 'ทำความสะอาดใหญ่', icon: Sparkles,     color: 'text-violet-300' },
  room_move_cleaning:  { label: 'หลังย้ายห้อง',   icon: ArrowRightLeft, color: 'text-teal-300' },
}
// Lower = higher priority
const TASK_PRIORITY: Record<string, number> = {
  checkout_cleaning: 0, room_move_cleaning: 1, deep_cleaning: 2, stayover_cleaning: 3,
}

function formatElapsed(fromISO: string, nowMs: number): string {
  const mins = Math.max(0, Math.floor((nowMs - new Date(fromISO).getTime()) / 60000))
  if (mins < 60) return `${mins} นาที`
  const h = Math.floor(mins / 60); const m = mins % 60
  return m ? `${h} ชม. ${m} นาที` : `${h} ชม.`
}

function isSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate()
}

// ── Circular progress ring ───────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const size = 120, stroke = 11, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-white/[0.08]" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round"
          className="fill-none stroke-emerald-400 transition-all duration-700 ease-out"
          style={{ strokeDasharray: c, strokeDashoffset: offset, filter: 'drop-shadow(0 0 6px rgba(52,211,153,0.5))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.75rem] font-black leading-none text-emerald-300 tabular-nums">{pct}%</span>
        <span className="mt-1 text-[0.625rem] font-medium uppercase tracking-widest text-stone-500">เสร็จวันนี้</span>
      </div>
    </div>
  )
}

// ── Pipeline legend item ─────────────────────────────────
function Legend({ dot, label, value, className }: { dot: string; label: string; value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-stone-400', className)}>
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      <span className="font-bold text-stone-100 tabular-nums">{value}</span>
      <span className="text-stone-500">{label}</span>
    </span>
  )
}

export default function HousekeepingPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [remarksDialog, setRemarksDialog] = useState<{ taskId: string } | null>(null)
  const [startConfirm, setStartConfirm] = useState<string | null>(null)
  const [remark, setRemark] = useState('')
  const [newTaskForm, setNewTaskForm] = useState({ roomId: '', taskType: 'stayover_cleaning' })
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Tick for live elapsed timers
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const { data: tasksRaw, isLoading } = useQuery({
    queryKey: ['housekeeping', 'all'],
    queryFn: () => housekeepingApi.tasks().then(r => r.data),
    refetchInterval: 10_000,
  })
  const { data: roomsRaw } = useQuery({ queryKey: ['rooms'], queryFn: () => roomsApi.list().then(r => r.data) })
  const { data: usersRaw } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list().then(r => r.data) })

  const tasks = (tasksRaw as HkTask[]) || []
  const rooms = (roomsRaw as RoomLite[]) || []
  const users = (usersRaw as UserLite[]) || []
  const userName = (id?: string | null) => {
    if (!id) return null
    const u = users.find(x => x.id === id)
    return u ? `${u.firstName} ${u.lastName}`.trim() : null
  }

  const invalidateRelated = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ['housekeeping'] })
    qc.invalidateQueries({ queryKey: ['hk-pending'] })
    qc.invalidateQueries({ queryKey: ['rooms'] })
    qc.invalidateQueries({ queryKey: ['room-map'] })
    qc.invalidateQueries({ queryKey: ['room-grid'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }, [qc])

  const startMutation = useMutation({
    mutationFn: (id: string) => housekeepingApi.start(id),
    onSuccess: () => { invalidateRelated(); toast.success('เริ่มทำความสะอาดแล้ว') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })
  const completeMutation = useMutation({
    mutationFn: ({ id, remark }: { id: string; remark?: string }) => housekeepingApi.complete(id, remark),
    onSuccess: () => { invalidateRelated(); setRemarksDialog(null); setRemark(''); toast.success('ทำความสะอาดเสร็จแล้ว ห้องพร้อมใช้งาน') },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => housekeepingApi.create(data),
    onSuccess: () => { invalidateRelated(); setCreateOpen(false); toast.success('สร้างงานสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })
  const quickCreate = useMutation({
    mutationFn: (roomId: string) => housekeepingApi.create({ roomId, taskType: 'checkout_cleaning' }),
    onSuccess: () => { invalidateRelated(); toast.success('สร้างงานทำความสะอาดแล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const now = new Date()

  // ── Derived buckets ──
  const { pending, inProgress, doneToday, dirtyNoTask, stats } = useMemo(() => {
    const openRoomIds = new Set(tasks.filter(t => ['pending', 'in_progress'].includes(t.status)).map(t => t.roomId))
    const dirtyNoTask = rooms.filter(r => r.currentStatus === 'dirty' && !openRoomIds.has(r.id))

    const isUrgent = (t: HkTask) => !!t.room.arrivalToday
    const sortPending = (a: HkTask, b: HkTask) => {
      if (isUrgent(a) !== isUrgent(b)) return isUrgent(a) ? -1 : 1
      const pa = TASK_PRIORITY[a.taskType] ?? 9, pb = TASK_PRIORITY[b.taskType] ?? 9
      if (pa !== pb) return pa - pb
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }

    const pending = tasks.filter(t => t.status === 'pending').sort(sortPending)
    const inProgress = tasks.filter(t => t.status === 'in_progress')
      .sort((a, b) => new Date(a.startedAt || a.createdAt).getTime() - new Date(b.startedAt || b.createdAt).getTime())
    const doneToday = tasks.filter(t => t.status === 'done' && t.completedAt && isSameLocalDay(t.completedAt, now))
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())

    const toDo = pending.length + inProgress.length + dirtyNoTask.length
    const cleanReady = rooms.filter(r => ['clean', 'inspected'].includes(r.currentStatus)).length
    const totalForPct = toDo + doneToday.length
    const progressPct = totalForPct > 0 ? Math.round((doneToday.length / totalForPct) * 100) : 0

    return {
      pending, inProgress, doneToday, dirtyNoTask,
      stats: {
        toClean: pending.length + dirtyNoTask.length,
        inProgress: inProgress.length,
        doneToday: doneToday.length,
        cleanReady,
        urgent: pending.filter(isUrgent).length,
        progressPct,
      },
    }
  }, [tasks, rooms]) // eslint-disable-line react-hooks/exhaustive-deps

  const cleaningRooms = rooms.length

  // ── Card renderer ──
  const TaskCard = ({ task }: { task: HkTask }) => {
    const cfg = TASK_TYPE[task.taskType] || { label: task.taskType, icon: Brush, color: 'text-stone-300' }
    const Icon = cfg.icon
    const urgent = !!task.room.arrivalToday
    const assignee = userName(task.assignedTo)
    return (
      <div className={cn(
        'rounded-2xl border p-4',
        task.status === 'pending' && (urgent ? 'border-red-400/40 bg-red-500/[0.12]' : 'border-amber-300/20 bg-amber-400/[0.08]'),
        task.status === 'in_progress' && 'border-sky-300/25 bg-sky-400/[0.10]',
        task.status === 'done' && 'border-emerald-300/15 bg-emerald-400/[0.06]',
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-stone-100">ห้อง {task.room.roomNumber}</span>
              {urgent && task.status !== 'done' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(220,38,38,0.5)] animate-pulse">
                  <AlertTriangle className="h-3 w-3" /> ด่วน
                </span>
              )}
            </div>
            <div className="text-xs text-stone-500 truncate">{task.room.zone?.name || task.room.roomType.name}</div>
          </div>
          <div className={cn('flex items-center gap-1 text-xs font-medium flex-shrink-0', cfg.color)}>
            <Icon className="h-3.5 w-3.5" /> {cfg.label}
          </div>
        </div>

        {/* Arrival urgency line */}
        {urgent && task.status !== 'done' && (
          <div className="mt-2 rounded-lg bg-red-500/10 border border-red-400/25 px-2.5 py-1.5 text-xs text-red-300">
            แขกเข้าวันนี้: <span className="font-semibold">{task.room.arrivalToday!.guestName}</span>
            <span className="text-red-400/70"> • ให้พร้อมก่อน {task.room.arrivalToday!.readyBy}</span>
          </div>
        )}

        {/* Meta */}
        <div className="mt-2 space-y-0.5">
          {task.status === 'in_progress' && task.startedAt && (
            <div className="flex items-center gap-1.5 text-xs text-sky-300">
              <Clock className="h-3.5 w-3.5" /> กำลังทำมา {formatElapsed(task.startedAt, nowMs)}
            </div>
          )}
          {task.status === 'done' && task.completedAt && (
            <div className="text-[0.6875rem] text-emerald-500">เสร็จ: {formatDateTime(task.completedAt)}</div>
          )}
          {assignee && task.status !== 'pending' && (
            <div className="flex items-center gap-1.5 text-[0.6875rem] text-stone-500">
              <User className="h-3 w-3" /> {assignee}
            </div>
          )}
          {task.remark && <div className="text-[0.6875rem] text-stone-500 italic truncate">“{task.remark}”</div>}
        </div>

        {/* Actions */}
        {task.status === 'pending' && (
          <Button size="sm" className="w-full h-10 text-xs mt-3" onClick={() => setStartConfirm(task.id)} loading={startMutation.isPending}>
            <Play className="h-3.5 w-3.5" /> เริ่มทำ
          </Button>
        )}
        {task.status === 'in_progress' && (
          <Button size="sm" className="w-full h-10 text-xs mt-3 bg-emerald-500 hover:bg-emerald-400" onClick={() => setRemarksDialog({ taskId: task.id })}>
            <CheckCircle className="h-3.5 w-3.5" /> เสร็จแล้ว
          </Button>
        )}
      </div>
    )
  }

  // ── Column wrapper ──
  const Column = ({ title, count, accent, children }: { title: string; count: number; accent: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', accent)} />
          <span className="text-sm font-bold text-stone-200">{title}</span>
        </div>
        <span className="text-xs font-semibold text-stone-500 tabular-nums">{count}</span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )

  const isEmpty = !isLoading && pending.length === 0 && inProgress.length === 0 && doneToday.length === 0 && dirtyNoTask.length === 0

  return (
    <AppShell
      title="แม่บ้าน"
      subtitle="จัดการงานทำความสะอาดห้องพัก"
      headerActions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> สร้างงาน</Button>}
    >
      <div className="space-y-5">
        {/* ── Progress hero ── */}
        {(() => {
          const pipeline = stats.toClean + stats.inProgress + stats.doneToday
          const seg = (v: number) => (pipeline > 0 ? (v / pipeline) * 100 : 0)
          return (
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.03] to-transparent p-5 sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                <ProgressRing pct={stats.progressPct} />

                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-bold text-stone-100">งานทำความสะอาดวันนี้</div>
                      <div className="mt-0.5 text-xs text-stone-500">
                        เสร็จแล้ว <span className="font-semibold text-emerald-300">{stats.doneToday}</span> จากทั้งหมด{' '}
                        <span className="font-semibold text-stone-300">{pipeline}</span> งาน
                      </div>
                    </div>
                    {stats.urgent > 0 && (
                      <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1.5 text-xs font-bold text-white shadow-[0_0_16px_rgba(220,38,38,0.5)] animate-pulse">
                        <AlertTriangle className="h-3.5 w-3.5" /> ด่วน {stats.urgent}
                      </span>
                    )}
                  </div>

                  {/* Pipeline stacked bar */}
                  <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-white/[0.05]">
                    {stats.toClean > 0 && <div className="h-full bg-amber-400/90 transition-all duration-700" style={{ width: `${seg(stats.toClean)}%` }} />}
                    {stats.inProgress > 0 && <div className="h-full bg-sky-400/90 transition-all duration-700" style={{ width: `${seg(stats.inProgress)}%` }} />}
                    {stats.doneToday > 0 && <div className="h-full bg-emerald-400/90 transition-all duration-700" style={{ width: `${seg(stats.doneToday)}%` }} />}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                    <Legend dot="bg-amber-400" label="รอทำ" value={stats.toClean} />
                    <Legend dot="bg-sky-400" label="กำลังทำ" value={stats.inProgress} />
                    <Legend dot="bg-emerald-400" label="เสร็จวันนี้" value={stats.doneToday} />
                    <Legend dot="bg-stone-300" label="พร้อมขาย" value={stats.cleanReady} className="sm:ml-auto" />
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : isEmpty ? (
          <EmptyState icon={Sparkles} title="ไม่มีงานทำความสะอาด" description={cleaningRooms ? 'ทุกห้องสะอาดและพร้อมบริการ' : 'ยังไม่มีห้องพักในระบบ'} />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* To do */}
            <Column title="รอดำเนินการ" count={pending.length + dirtyNoTask.length} accent="bg-amber-400">
              {/* Dirty rooms without a task — safety net */}
              {dirtyNoTask.map(room => (
                <div key={`dirty-${room.id}`} className="rounded-2xl border border-dashed border-amber-300/30 bg-amber-400/[0.04] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-bold text-stone-100">ห้อง {room.roomNumber}</div>
                      <div className="text-xs text-stone-500">{room.zone?.name || room.roomType?.name}</div>
                    </div>
                    <span className="rounded-full bg-amber-500/20 border border-amber-300/30 px-2 py-0.5 text-[10px] font-medium text-amber-200">ยังไม่มีงาน</span>
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-10 text-xs mt-3"
                    onClick={() => quickCreate.mutate(room.id)} loading={quickCreate.isPending}>
                    <Plus className="h-3.5 w-3.5" /> สร้างงานทำความสะอาด
                  </Button>
                </div>
              ))}
              {pending.map(task => <TaskCard key={task.id} task={task} />)}
              {pending.length + dirtyNoTask.length === 0 && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-8 text-center text-xs text-stone-600">ไม่มีงานรอ</div>
              )}
            </Column>

            {/* In progress */}
            <Column title="กำลังทำ" count={inProgress.length} accent="bg-sky-400">
              {inProgress.map(task => <TaskCard key={task.id} task={task} />)}
              {inProgress.length === 0 && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-8 text-center text-xs text-stone-600">ยังไม่มีงานที่กำลังทำ</div>
              )}
            </Column>

            {/* Done today */}
            <Column title="เสร็จแล้ว (วันนี้)" count={doneToday.length} accent="bg-emerald-400">
              {doneToday.map(task => <TaskCard key={task.id} task={task} />)}
              {doneToday.length === 0 && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-8 text-center text-xs text-stone-600">ยังไม่มีงานเสร็จวันนี้</div>
              )}
            </Column>
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
          <RoomPicker
            label="ห้อง *"
            value={newTaskForm.roomId}
            onChange={v => setNewTaskForm(p => ({ ...p, roomId: v }))}
            rooms={rooms.map(r => ({
              id: r.id,
              roomNumber: r.roomNumber,
              roomName: r.roomName,
              currentStatus: r.currentStatus,
              zone: r.zone?.name ?? null,
              roomType: r.roomType?.name ?? null,
            }))}
          />
          <Select value={newTaskForm.taskType} onValueChange={v => setNewTaskForm(p => ({ ...p, taskType: v }))}>
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
