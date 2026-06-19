'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Plus, Users, Phone, Mail, AlertTriangle, User,
  LayoutGrid, List, Star, UserPlus, CalendarClock, MapPin,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ViewToggle } from '@/components/ui/view-toggle'
import { SearchToggle } from '@/components/ui/search-toggle'
import { guestsApi } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import Link from 'next/link'

interface GuestForm {
  firstName: string; lastName: string; phone: string; email: string
  nationality: string; idType: string; idNumber: string; address: string; remark: string
}

interface Guest {
  id: string; firstName: string; lastName: string
  phone?: string | null; email?: string | null; nationality?: string | null
  idType?: string | null; idNumber?: string | null; address?: string | null; remark?: string | null
  blacklistFlag: boolean
  stayCount?: number; lastVisit?: string | null; nextVisit?: string | null
}

const defaultForm: GuestForm = { firstName: '', lastName: '', phone: '', email: '', nationality: '', idType: '', idNumber: '', address: '', remark: '' }
const pillBase = 'rounded-full px-3 py-1 text-xs font-medium border transition-all'
const pillIdle = 'border-white/10 text-stone-500 hover:border-white/20 hover:text-stone-300'
const pillActive = 'bg-amber-400/15 border-amber-300/30 text-amber-200'

function initials(g: Guest) {
  return `${g.firstName?.[0] || ''}${g.lastName?.[0] || ''}`.toUpperCase()
}

// Past stay summary — a clear, past-tense concept on its own.
function lastStayText(g: Guest): string {
  return g.lastVisit ? formatDate(g.lastVisit, 'dd MMM yy') : 'ลูกค้าใหม่'
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-stone-100 leading-none">{value}</div>
        <div className="text-xs text-stone-500 mt-1 truncate">{label}</div>
      </div>
    </div>
  )
}

export default function GuestsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [nationality, setNationality] = useState('')
  const [returningOnly, setReturningOnly] = useState(false)
  const [blacklistOnly, setBlacklistOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'card' | 'table'>('table')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<GuestForm>(defaultForm)

  // Debounce search so we fire one request after typing settles.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['guests', page, debouncedSearch, nationality, returningOnly, blacklistOnly],
    queryFn: () => guestsApi.list({
      page, limit: 20,
      search: debouncedSearch || undefined,
      nationality: nationality || undefined,
      returning: returningOnly || undefined,
      blacklist: blacklistOnly || undefined,
    }).then(r => r.data),
    staleTime: 30_000,
  })

  const { data: stats } = useQuery({ queryKey: ['guest-stats'], queryFn: () => guestsApi.stats().then(r => r.data) })
  const { data: nationalities = [] } = useQuery<string[]>({ queryKey: ['guest-nationalities'], queryFn: () => guestsApi.nationalities().then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => guestsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); qc.invalidateQueries({ queryKey: ['guest-stats'] }); setDialogOpen(false); toast.success('เพิ่มลูกค้าสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => guestsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); qc.invalidateQueries({ queryKey: ['guest-stats'] }); setDialogOpen(false); toast.success('แก้ไขสำเร็จ') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const handleSubmit = () => {
    if (!form.firstName || !form.lastName) { toast.error('กรุณาระบุชื่อและนามสกุล'); return }
    const payload = { firstName: form.firstName, lastName: form.lastName, phone: form.phone || undefined, email: form.email || undefined, nationality: form.nationality || undefined, idType: form.idType || undefined, idNumber: form.idNumber || undefined, address: form.address || undefined, remark: form.remark || undefined }
    if (editId) updateMutation.mutate({ id: editId, data: payload })
    else createMutation.mutate(payload)
  }

  const openEdit = (g: Guest) => {
    setEditId(g.id)
    setForm({ firstName: g.firstName, lastName: g.lastName, phone: g.phone || '', email: g.email || '', nationality: g.nationality || '', idType: g.idType || '', idNumber: g.idNumber || '', address: g.address || '', remark: g.remark || '' })
    setDialogOpen(true)
  }

  const guests = (data?.guests as Guest[]) || []
  const activeFilters = (nationality ? 1 : 0) + (returningOnly ? 1 : 0) + (blacklistOnly ? 1 : 0)

  return (
    <AppShell title="ลูกค้า" subtitle={stats ? `${stats.total} รายชื่อในระบบ` : 'ฐานข้อมูลลูกค้าทั้งหมด'}>
      <div className="space-y-5">
        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Users} label="ลูกค้าทั้งหมด" value={stats?.total ?? 0} tone="bg-amber-400/15 text-amber-300" />
          <StatCard icon={Star} label="ลูกค้าประจำ" value={stats?.returning ?? 0} tone="bg-emerald-400/15 text-emerald-300" />
          <StatCard icon={UserPlus} label="เพิ่มใหม่เดือนนี้" value={stats?.newThisMonth ?? 0} tone="bg-sky-400/15 text-sky-300" />
          <StatCard icon={AlertTriangle} label="Blacklist" value={stats?.blacklist ?? 0} tone="bg-rose-400/15 text-rose-300" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <div className="ml-auto flex items-center gap-2">
            <SearchToggle
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              placeholder="ค้นหาชื่อ เบอร์โทร อีเมล..."
            />
            <ViewToggle
              value={view}
              onChange={setView}
              options={[
                { value: 'table', label: 'ตาราง', icon: List },
                { value: 'card', label: 'การ์ด', icon: LayoutGrid },
              ]}
            />
            <Button size="sm" onClick={() => { setEditId(null); setForm(defaultForm); setDialogOpen(true) }}>
              <Plus className="h-4 w-4" /> เพิ่มลูกค้า
            </Button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => { setNationality(''); setPage(1) }} className={cn(pillBase, nationality === '' ? pillActive : pillIdle)}>
            ทุกสัญชาติ
          </button>
          {nationalities.map(n => (
            <button key={n} onClick={() => { setNationality(nationality === n ? '' : n); setPage(1) }}
              className={cn(pillBase, nationality === n ? pillActive : pillIdle)}>
              {n}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" />
          <button onClick={() => { setReturningOnly(v => !v); setPage(1) }}
            className={cn(pillBase, 'flex items-center gap-1', returningOnly ? 'bg-emerald-400/15 border-emerald-300/30 text-emerald-200' : pillIdle)}>
            <Star className="h-3 w-3" /> ลูกค้าประจำ
          </button>
          <button onClick={() => { setBlacklistOnly(v => !v); setPage(1) }}
            className={cn(pillBase, 'flex items-center gap-1', blacklistOnly ? 'bg-rose-400/15 border-rose-300/30 text-rose-200' : pillIdle)}>
            <AlertTriangle className="h-3 w-3" /> Blacklist
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          view === 'card' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
            </div>
          ) : (
            <GlassPanel dense padding="none">
              <div className="divide-y divide-white/5">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                    <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-28" /></div>
                    <Skeleton className="h-7 w-16 rounded-lg flex-shrink-0" />
                  </div>
                ))}
              </div>
            </GlassPanel>
          )
        ) : !guests.length ? (
          <EmptyState
            icon={Users}
            title="ไม่พบลูกค้า"
            description={debouncedSearch || activeFilters ? 'ลองล้างตัวกรองหรือค้นหาด้วยคำอื่น' : 'ยังไม่มีข้อมูลลูกค้า'}
            className="py-16"
          />
        ) : view === 'card' ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {guests.map((g, i) => {
              const isNew = !g.lastVisit && !(g.stayCount ?? 0)
              const isReturning = (g.stayCount ?? 0) > 1
              // Pick avatar gradient based on guest type
              const avatarCls = g.blacklistFlag
                ? 'from-rose-500/40 to-rose-700/30 text-rose-200'
                : isReturning
                ? 'from-emerald-500/30 to-emerald-700/20 text-emerald-200'
                : 'from-amber-500/30 to-amber-700/20 text-amber-200'

              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.25), duration: 0.18, ease: 'easeOut' }}
                  className="group relative"
                >
                  <Link href={`/guests/${g.id}`} className="flex flex-col items-center gap-2 rounded-2xl p-3 transition-all hover:bg-white/[0.06]">
                    {/* Circular avatar */}
                    <div className="relative">
                      <div className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-xl font-black shadow-lg ring-2 ring-white/[0.08]',
                        avatarCls,
                      )}>
                        {initials(g) || <User className="h-7 w-7" />}
                      </div>
                      {/* Status indicators */}
                      {isNew && (
                        <span className="absolute -top-1 -right-1 flex h-5 items-center rounded-full bg-emerald-500 px-1.5 text-[0.55rem] font-black uppercase tracking-wide text-white shadow">
                          NEW
                        </span>
                      )}
                      {g.blacklistFlag && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 shadow">
                          <AlertTriangle className="h-3 w-3 text-white" />
                        </span>
                      )}
                      {isReturning && !g.blacklistFlag && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 shadow">
                          <Star className="h-3 w-3 text-white" />
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <div className="w-full text-center">
                      <p className="text-xs font-semibold text-stone-100 truncate leading-tight">
                        {g.firstName}
                      </p>
                      <p className="text-xs text-stone-500 truncate leading-tight mt-0.5">
                        {g.lastName}
                      </p>
                      <p className="text-[0.625rem] text-stone-600 truncate mt-1 leading-tight">
                        {g.nationality || (g.stayCount ? `${g.stayCount} ครั้ง` : 'ลูกค้าใหม่')}
                      </p>
                    </div>
                  </Link>

                  {/* Edit on hover */}
                  <button
                    onClick={() => openEdit(g)}
                    title="แก้ไข"
                    className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-lg bg-black/50 text-stone-400 opacity-0 transition-opacity hover:text-amber-300 group-hover:opacity-100"
                  >
                    <span className="text-[0.6rem] font-bold">✎</span>
                  </button>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {guests.map((g, i) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.25), duration: 0.18 }}
                className={cn(
                  'group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 transition-all hover:bg-white/[0.07] hover:border-white/[0.14]',
                  g.blacklistFlag && 'border-rose-400/20 bg-rose-400/[0.04]',
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold',
                  g.blacklistFlag ? 'bg-rose-400/15 text-rose-300' : (g.stayCount ?? 0) > 1 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300',
                )}>
                  {initials(g) || <User className="h-5 w-5" />}
                </div>

                {/* Name + blacklist */}
                <div className="min-w-0 w-44 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-stone-100 text-sm truncate">{g.firstName} {g.lastName}</span>
                    {g.blacklistFlag && <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-rose-400" />}
                  </div>
                  {g.nationality && (
                    <span className="flex items-center gap-1 text-xs text-stone-500 mt-0.5">
                      <MapPin className="h-3 w-3" />{g.nationality}
                    </span>
                  )}
                </div>

                {/* Contact */}
                <div className="hidden sm:flex flex-col flex-1 min-w-0">
                  {g.phone && <div className="flex items-center gap-1.5 text-xs text-stone-400 truncate"><Phone className="h-3 w-3 flex-shrink-0" />{g.phone}</div>}
                  {g.email && <div className="flex items-center gap-1.5 text-xs text-stone-500 truncate"><Mail className="h-3 w-3 flex-shrink-0" />{g.email}</div>}
                  {!g.phone && !g.email && <span className="text-xs text-stone-700">ไม่มีข้อมูลติดต่อ</span>}
                </div>

                {/* Stay count */}
                <div className="hidden md:flex flex-col items-center flex-shrink-0 w-20">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold',
                    (g.stayCount ?? 0) > 1 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.05] text-stone-500',
                  )}>
                    {(g.stayCount ?? 0) > 1 && <Star className="h-3 w-3" />}
                    {g.stayCount ?? 0} ครั้ง
                  </span>
                </div>

                {/* Last visit */}
                <div className="hidden lg:flex flex-col items-end flex-shrink-0 w-28 text-right">
                  <span className="text-xs font-medium text-stone-300">{g.lastVisit ? formatDate(g.lastVisit, 'dd MMM yy') : '—'}</span>
                  <span className="text-xs text-stone-600 mt-0.5">เข้าพักล่าสุด</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link href={`/guests/${g.id}`} onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" title="ดูโปรไฟล์"><User className="h-3.5 w-3.5" /></Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>แก้ไข</Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.total > data.limit && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">
              แสดง {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} จาก {data.total} รายชื่อ
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                ← ก่อนหน้า
              </Button>
              <span className="text-xs text-stone-500 w-16 text-center">{page} / {Math.ceil(data.total / data.limit)}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total}>
                ถัดไป →
              </Button>
            </div>
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
