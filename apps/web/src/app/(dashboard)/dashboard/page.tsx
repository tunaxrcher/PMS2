'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BedDouble, CalendarCheck, CalendarX2, Sparkles,
  TrendingUp, Users, Wrench, ArrowUpRight, ArrowDownRight,
  Clock, DoorOpen, DoorClosed, Activity, BarChart3, Percent,
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { AppShell } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { reportsApi, housekeepingApi, bookingsApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { StaggerList, StaggerItem } from '@/components/ui/page-transition'
import Link from 'next/link'

// Circular gauge
function OccupancyGauge({ pct, occupied, total }: { pct: number; occupied: number; total: number }) {
  const size = 140
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <motion.circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={pct > 80 ? '#f87171' : pct > 50 ? '#fbbf24' : '#34d399'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-stone-50">{pct}%</span>
          <span className="text-xs text-stone-500">Occupancy</span>
        </div>
      </div>
      <div className="mt-2 flex gap-4 text-xs">
        <span className="text-rose-400">{occupied} เข้าพัก</span>
        <span className="text-stone-500">{total - occupied} ว่าง</span>
      </div>
    </div>
  )
}

// Mini stat card with color band
function MiniCard({
  icon: Icon, label, value, sub, color, href, loading
}: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; href?: string; loading?: boolean }) {
  const content = (
    <motion.div
      className={`group relative overflow-hidden rounded-2xl border border-white/12 bg-black/25 backdrop-blur-xl p-4 cursor-pointer hover:border-white/20 transition-all`}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-stone-500 font-medium">{label}</p>
          {loading ? <Skeleton className="mt-1 h-7 w-20" /> : (
            <p className="mt-0.5 text-2xl font-bold text-stone-50 leading-none">{value}</p>
          )}
          {sub && <p className="mt-1 text-xs text-stone-600">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ${color.replace('bg-', 'text-').replace('-500', '-400')}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </motion.div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

export default function DashboardPage() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.dashboard().then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: arrivals } = useQuery({
    queryKey: ['bookings', 'arrivals-today'],
    queryFn: () => bookingsApi.list({ checkInDate: today, status: 'confirmed', limit: 6 }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: departures } = useQuery({
    queryKey: ['bookings', 'departures-today'],
    queryFn: () => bookingsApi.list({ checkOutDate: today, status: 'checked_in', limit: 6 }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: hkTasks } = useQuery({
    queryKey: ['hk-pending'],
    queryFn: () => housekeepingApi.tasks({ status: 'pending' }).then(r => r.data),
    refetchInterval: 10_000,
  })

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'อรุณสวัสดิ์'
    if (h < 17) return 'สวัสดีตอนบ่าย'
    return 'สวัสดีตอนเย็น'
  }

  const occ = dashboard?.occupancy
  const rev = dashboard?.revenue

  return (
    <AppShell>
      <StaggerList className="space-y-5">
        {/* Header */}
        <StaggerItem>
          <div className="flex items-end justify-between">
            <div>
              <motion.h1 className="text-3xl font-bold text-stone-50 tracking-tight" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
                {greeting()}, {user?.firstName} 👋
              </motion.h1>
              <p className="mt-1 text-sm text-stone-500">{format(new Date(), "EEEE d MMMM yyyy", { locale: th })}</p>
            </div>
            <motion.div
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-stone-400">Live Dashboard</span>
            </motion.div>
          </div>
        </StaggerItem>

        {/* Main grid */}
        <StaggerItem>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Occupancy gauge - large card */}
            <motion.div
              className="rounded-3xl border border-white/15 bg-black/30 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.40)] overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold text-stone-200">สถานะห้องพัก</span>
                </div>
                <Link href="/room-grid" className="text-xs text-amber-400 hover:text-amber-300">ดูปฏิทิน →</Link>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center p-8"><Skeleton className="h-36 w-36 rounded-full" /></div>
              ) : (
                <OccupancyGauge pct={occ?.occupancyPct ?? 0} occupied={occ?.occupied ?? 0} total={occ?.totalRooms ?? 0} />
              )}
              <div className="px-4 pb-4 grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  { label: 'เข้าพัก', val: occ?.occupied ?? 0, color: 'text-rose-400' },
                  { label: 'ว่าง', val: occ?.available ?? 0, color: 'text-emerald-400' },
                  { label: 'OOO', val: occ?.outOfOrder ?? 0, color: 'text-stone-500' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-white/[0.04] py-2">
                    <div className={`text-lg font-bold ${s.color}`}>{s.val}</div>
                    <div className="text-stone-600">{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Revenue card */}
            <motion.div
              className="rounded-3xl border border-white/15 bg-black/30 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.40)] overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold text-stone-200">รายได้วันนี้</span>
                </div>
                <Link href="/reports" className="text-xs text-amber-400 hover:text-amber-300">รายงาน →</Link>
              </div>
              <div className="p-5">
                {isLoading ? <Skeleton className="h-10 w-40" /> : (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <div className="text-4xl font-bold text-stone-50 tracking-tight">
                      {formatCurrency(rev?.totalNet ?? 0)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">{rev?.transactionCount ?? 0} รายการ</div>
                  </motion.div>
                )}

                <div className="mt-5 space-y-2.5">
                  {[
                    { label: 'เงินสด', key: 'cash', color: 'bg-amber-400' },
                    { label: 'โอนเงิน', key: 'transfer', color: 'bg-sky-400' },
                    { label: 'บัตรเครดิต', key: 'credit_card', color: 'bg-violet-400' },
                    { label: 'OTA', key: 'ota', color: 'bg-rose-400' },
                  ].map(m => {
                    const amt = rev?.byMethod?.[m.key] ?? 0
                    const pct = rev?.totalGross > 0 ? (amt / rev.totalGross) * 100 : 0
                    return (
                      <div key={m.key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-stone-500">{m.label}</span>
                          <span className="text-stone-300 font-medium">{formatCurrency(amt)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06]">
                          <motion.div
                            className={`h-full rounded-full ${m.color}/70`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* Quick actions grid */}
            <motion.div
              className="flex flex-col gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <MiniCard icon={DoorOpen} label="เช็คอินวันนี้" value={dashboard?.arrivals ?? 0} sub="รอเช็คอิน" color="bg-emerald-500" href="/bookings?status=confirmed" loading={isLoading} />
              <MiniCard icon={DoorClosed} label="เช็คเอาท์วันนี้" value={dashboard?.departures ?? 0} sub="รอเช็คเอาท์" color="bg-amber-500" href="/bookings?status=checked_in" loading={isLoading} />
              <MiniCard icon={Sparkles} label="งานแม่บ้านค้าง" value={dashboard?.pendingHousekeeping ?? 0} sub="รอดำเนินการ" color="bg-sky-500" href="/housekeeping" loading={isLoading} />
              <MiniCard icon={Wrench} label="ห้อง Out of Order" value={occ?.outOfOrder ?? 0} sub="ออกจากการขาย" color="bg-rose-500" href="/maintenance" loading={isLoading} />
            </motion.div>
          </div>
        </StaggerItem>

        {/* Arrivals & Departures */}
        <StaggerItem>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Arrivals */}
            <motion.div
              className="rounded-3xl border border-white/15 bg-black/30 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.35)] overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <DoorOpen className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-stone-200">เช็คอินวันนี้</span>
                  {arrivals?.bookings?.length > 0 && (
                    <span className="ml-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">{arrivals.bookings.length}</span>
                  )}
                </div>
                <Link href="/bookings?status=confirmed" className="text-xs text-stone-500 hover:text-stone-300">ดูทั้งหมด</Link>
              </div>
              <div className="p-3 space-y-1.5">
                {!arrivals?.bookings?.length ? (
                  <EmptyState icon={CalendarCheck} title="ไม่มีเช็คอินวันนี้" className="py-5" />
                ) : (
                  (arrivals.bookings as Array<{
                    id: string; bookingNumber: string; status: string
                    guest: { firstName: string; lastName: string }
                    bookingRooms: Array<{ roomType: { name: string }; room?: { roomNumber: string } | null }>
                    adults: number; children: number
                  }>).map((b, i) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.06 }}
                    >
                      <Link href={`/bookings/${b.id}`}
                        className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 hover:bg-white/[0.07] transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-sm font-bold text-emerald-300">
                            {b.guest.firstName[0]}{b.guest.lastName[0]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-stone-200 group-hover:text-stone-100">
                              {b.guest.firstName} {b.guest.lastName}
                            </div>
                            <div className="text-xs text-stone-500">
                              {b.bookingRooms[0]?.room?.roomNumber || b.bookingRooms[0]?.roomType?.name} • {b.adults}ผู้ใหญ่{b.children > 0 ? ` ${b.children}เด็ก` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={b.status} size="sm" />
                          <ArrowUpRight className="h-3.5 w-3.5 text-stone-600 group-hover:text-stone-400 transition-colors" />
                        </div>
                      </Link>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Departures */}
            <motion.div
              className="rounded-3xl border border-white/15 bg-black/30 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.35)] overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <DoorClosed className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold text-stone-200">เช็คเอาท์วันนี้</span>
                  {departures?.bookings?.length > 0 && (
                    <span className="ml-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">{departures.bookings.length}</span>
                  )}
                </div>
                <Link href="/bookings?status=checked_in" className="text-xs text-stone-500 hover:text-stone-300">ดูทั้งหมด</Link>
              </div>
              <div className="p-3 space-y-1.5">
                {!departures?.bookings?.length ? (
                  <EmptyState icon={CalendarX2} title="ไม่มีเช็คเอาท์วันนี้" className="py-5" />
                ) : (
                  (departures.bookings as Array<{
                    id: string; bookingNumber: string; status: string
                    guest: { firstName: string; lastName: string }
                    bookingRooms: Array<{ roomType: { name: string }; room?: { roomNumber: string } | null }>
                    checkOutDate: string
                  }>).map((b, i) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.06 }}
                    >
                      <Link href={`/bookings/${b.id}`}
                        className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 hover:bg-white/[0.07] transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-sm font-bold text-amber-300">
                            {b.guest.firstName[0]}{b.guest.lastName[0]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-stone-200">{b.guest.firstName} {b.guest.lastName}</div>
                            <div className="text-xs text-stone-500">
                              {b.bookingRooms[0]?.room?.roomNumber || b.bookingRooms[0]?.roomType?.name}
                              <span className="ml-2 text-amber-500/80">Due out {format(new Date(b.checkOutDate), 'HH:mm', { locale: th })}</span>
                            </div>
                          </div>
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 text-stone-600 group-hover:text-stone-400 transition-colors" />
                      </Link>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </StaggerItem>

        {/* Housekeeping strip — zone image cards */}
        {(hkTasks as unknown[] || []).length > 0 && (
          <StaggerItem>
            <motion.div
              className="rounded-3xl border border-white/15 bg-black/30 backdrop-blur-xl overflow-hidden"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-400" />
                  <span className="text-sm font-semibold text-stone-200">งานแม่บ้านค้าง</span>
                  <span className="rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">{(hkTasks as unknown[]).length}</span>
                </div>
                <Link href="/housekeeping" className="text-xs text-amber-400 hover:text-amber-300">ดูทั้งหมด →</Link>
              </div>
              <div className="flex gap-3 overflow-x-auto p-4">
                {(hkTasks as Array<{
                  id: string; status: string; taskType: string
                  room: {
                    roomNumber: string
                    zone?: { name: string; imageUrl?: string | null } | null
                    roomType: { name: string; imageUrl?: string | null }
                  }
                }>).slice(0, 8).map((task, i) => {
                  const bgImage = task.room.zone?.imageUrl || task.room.roomType?.imageUrl
                  const statusColors: Record<string, string> = {
                    pending: 'bg-amber-400/80 text-stone-900',
                    in_progress: 'bg-sky-400/80 text-stone-900',
                    done: 'bg-emerald-400/80 text-stone-900',
                  }
                  const taskLabel: Record<string, string> = {
                    checkout_cleaning: 'หลัง Check-out',
                    stayover_cleaning: 'ระหว่างพัก',
                    deep_cleaning: 'ทำความสะอาดใหญ่',
                  }
                  return (
                    <motion.div
                      key={task.id}
                      className="relative flex-shrink-0 w-40 h-28 rounded-2xl overflow-hidden border border-white/15 cursor-pointer group"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.06 }}
                      whileHover={{ scale: 1.04 }}
                    >
                      {/* Zone image bg */}
                      {bgImage ? (
                        <img src={bgImage} alt={task.room.zone?.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-900" />
                      )}
                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      {/* Content */}
                      <div className="absolute inset-0 flex flex-col justify-between p-3">
                        {/* Status badge top-right */}
                        <div className="flex justify-end">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColors[task.status] || 'bg-stone-400/80 text-stone-900'}`}>
                            {task.status === 'pending' ? 'รอทำ' : task.status === 'in_progress' ? 'กำลังทำ' : 'เสร็จ'}
                          </span>
                        </div>
                        {/* Room info bottom */}
                        <div>
                          <div className="text-base font-bold text-white leading-tight">ห้อง {task.room.roomNumber}</div>
                          <div className="text-[10px] text-stone-300/80 mt-0.5">{task.room.zone?.name || task.room.roomType?.name}</div>
                          <div className="text-[10px] text-stone-400/70 mt-0.5">{taskLabel[task.taskType] || task.taskType}</div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </StaggerItem>
        )}
      </StaggerList>
    </AppShell>
  )
}
