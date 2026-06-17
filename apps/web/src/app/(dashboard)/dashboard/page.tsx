'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BedDouble, DoorOpen, DoorClosed, Sparkles, Wrench,
  TrendingUp, Activity, ChevronDown, ChevronLeft, ChevronRight,
  Plus, Building2, MapPin,
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { AppShell } from '@/components/layout/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { reportsApi, housekeepingApi, bookingsApi } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────
interface BookingItem {
  id: string; bookingNumber: string; status: string
  guest: { firstName: string; lastName: string }
  bookingRooms: Array<{ roomType: { name: string }; room?: { roomNumber: string } | null }>
  adults: number; children: number; checkOutDate: string
}

interface HkTask {
  id: string; status: string; taskType: string
  room: {
    roomNumber: string; roomName?: string | null
    zone?: { name: string; imageUrl?: string | null } | null
    roomType: { name: string; imageUrl?: string | null }
  }
}

// ── Number count-up hook ───────────────────────────────────────
function useCountUp(target: number, duration = 1000, delay = 400) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!target) { setValue(0); return }
    let startTime: number | null = null
    const step = (ts: number) => {
      if (!startTime) startTime = ts + delay
      const elapsed = Math.max(0, ts - startTime)
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration, delay])

  return value
}

// ── Constants (outside component to avoid recreation on every render) ──
const PAYMENT_METHODS = [
  { key: 'cash',        label: 'เงินสด',  color: 'bg-amber-400'  },
  { key: 'transfer',    label: 'โอนเงิน', color: 'bg-sky-400'    },
  { key: 'credit_card', label: 'บัตร',     color: 'bg-violet-400' },
  { key: 'ota',         label: 'OTA',      color: 'bg-rose-400'   },
]

// ── Glass card ─────────────────────────────────────────────────
function GlassCard({ children, className = '', delay = 0, ...props }: React.HTMLAttributes<HTMLDivElement> & { delay?: number }) {
  return (
    <motion.div
      className={cn('rounded-3xl border border-white/[0.14] bg-white/[0.06] backdrop-blur-xl overflow-hidden', className)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      {...(props as object)}
    >
      {children}
    </motion.div>
  )
}

// ── Circular Gauge ────────────────────────────────────────────
function OccupancyGauge({ pct, occupied, available, ooo }: { pct: number; occupied: number; available: number; ooo: number }) {
  const size = 130, stroke = 10, r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const color = pct > 80 ? '#f87171' : pct > 50 ? '#fbbf24' : '#34d399'
  return (
    <div className="flex flex-col items-center justify-center py-4 px-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <motion.circle
            cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
            transition={{ duration: 1.3, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-stone-50">{pct}%</span>
          <span className="text-[10px] text-stone-600 mt-0.5">Occupancy</span>
        </div>
      </div>
      <div className="mt-3 w-full grid grid-cols-3 gap-1.5 text-center text-[11px]">
        <div className="rounded-2xl bg-rose-500/10 py-2">
          <div className="font-bold text-rose-300 text-base">{occupied}</div>
          <div className="text-stone-600 text-[9px] mt-0.5">เข้าพัก</div>
        </div>
        <div className="rounded-2xl bg-emerald-500/10 py-2">
          <div className="font-bold text-emerald-300 text-base">{available}</div>
          <div className="text-stone-600 text-[9px] mt-0.5">ว่าง</div>
        </div>
        <div className="rounded-2xl bg-stone-500/10 py-2">
          <div className="font-bold text-stone-400 text-base">{ooo}</div>
          <div className="text-stone-600 text-[9px] mt-0.5">OOO</div>
        </div>
      </div>
    </div>
  )
}

// ── Compact Booking Row ────────────────────────────────────────
function BookingRow({ b, type, index = 0 }: { b: BookingItem; type: 'in' | 'out'; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.07, duration: 0.25 }}
    >
    <Link href={`/bookings/${b.id}`}
      className="flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-white/[0.05] transition-colors group">
      <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl text-[11px] font-bold',
        type === 'in' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300')}>
        {b.guest.firstName[0]}{b.guest.lastName[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-stone-200 truncate">{b.guest.firstName} {b.guest.lastName}</div>
        <div className="text-[10px] text-stone-600 truncate">{b.bookingRooms[0]?.room?.roomNumber || b.bookingRooms[0]?.roomType?.name}</div>
      </div>
      <StatusBadge status={b.status} size="sm" />
    </Link>
    </motion.div>
  )
}

// ── Mini Ring Gauge (weather icon equivalent) ─────────────────
function MiniRing({ pct }: { pct: number }) {
  const sz = 64, sw = 7, r = (sz - sw) / 2
  const circ = 2 * Math.PI * r
  const col = pct > 80 ? '#f87171' : pct > 50 ? '#fbbf24' : '#34d399'
  return (
    <div className="relative flex-shrink-0" style={{ width: sz, height: sz }}>
      <svg width={sz} height={sz} className="-rotate-90">
        <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
        <motion.circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={col} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.25 }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <BedDouble className="h-5 w-5" style={{ color: col }} />
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [roomIdx, setRoomIdx] = useState(0)

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.dashboard().then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: arrivals } = useQuery({
    queryKey: ['bookings', 'arrivals-today'],
    queryFn: () => bookingsApi.list({ checkInDate: today, status: 'confirmed', limit: 5 }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: departures } = useQuery({
    queryKey: ['bookings', 'departures-today'],
    queryFn: () => bookingsApi.list({ checkOutDate: today, status: 'checked_in', limit: 5 }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: hkTasks } = useQuery({
    queryKey: ['hk-pending'],
    queryFn: () => housekeepingApi.tasks({ status: 'pending' }).then(r => r.data),
    refetchInterval: 10_000,
  })

  const occ = dashboard?.occupancy
  const rev = dashboard?.revenue
  const arrList: BookingItem[] = arrivals?.bookings || []
  const depList: BookingItem[] = departures?.bookings || []
  const hkList: HkTask[] = (hkTasks as HkTask[]) || []

  // Count-up animations — placed after data is available
  const occPct    = useCountUp(occ?.occupancyPct ?? 0, 1200, 400)
  const revAmount = useCountUp(rev?.totalNet ?? 0, 1400, 500)
  const hkCount   = useCountUp(dashboard?.pendingHousekeeping ?? 0, 800, 450)
  const oooCount  = useCountUp(occ?.outOfOrder ?? 0, 800, 500)

  // Rooms to cycle through in the center widget
  const liveRooms = hkList.filter(t => t.room.zone?.imageUrl || t.room.roomType?.imageUrl)
  const activeRoom = liveRooms[roomIdx] || hkList[roomIdx]
  const roomImage = activeRoom?.room.zone?.imageUrl || activeRoom?.room.roomType?.imageUrl

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'อรุณสวัสดิ์'
    if (h < 17) return 'สวัสดีตอนบ่าย'
    return 'สวัสดีตอนเย็น'
  }

  return (
    <AppShell>
      <div className="grid grid-cols-12 gap-3.5">

        {/* ═══════════════════════════════════════════════ */}
        {/* ROW 1  — 4.5 : 3.75 : 3.75 custom grid       */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="col-span-12 grid grid-cols-[4.3fr_3.85fr_3.85fr] gap-3.5">

        {/* LEFT — no card, floating text (like reference) */}
        <motion.div
          className="flex flex-col justify-between py-1 px-1"
          style={{ minHeight: '100%' }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Greeting + property name */}
          <div>
            <p className="text-base text-stone-300 font-medium">{greeting()}, {user?.firstName}!</p>
            <h1 className="mt-2 text-5xl font-black text-stone-50 leading-[1.05] tracking-tight break-words">
              {user?.property?.name || 'Serene Resort'}
            </h1>
            <p className="mt-3 text-sm text-stone-400">
              {format(new Date(), 'EEEE, d MMMM yyyy', { locale: th })}
            </p>
          </div>

          {/* Members */}
          <div className="mt-6">
            <p className="text-[10px] text-stone-600 mb-2.5 font-semibold tracking-widest uppercase">Members</p>
            <div className="flex items-center -space-x-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-400/50 bg-amber-400/15 text-sm font-bold text-amber-300 z-10">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              {['SM', 'PK', 'NK', 'TT'].map((initials, i) => (
                <div key={initials} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-stone-800 bg-stone-700/60 text-[11px] font-medium text-stone-400"
                  style={{ zIndex: 9 - i }}>
                  {initials}
                </div>
              ))}
              <button className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/15 text-stone-700 hover:border-white/25 hover:text-stone-500 transition-colors ml-2.5">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Live indicator */}
          <div className="mt-4 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] text-stone-600">Live Dashboard</span>
          </div>
        </motion.div>

        {/* CENTER — Room image widget (camera-like, header+footer overlaid on image) */}
        <GlassCard className="relative" delay={0.05} style={{ aspectRatio: '16/10' }}>
          {/* Room image — fills entire card */}
          <AnimatePresence mode="wait">
            {roomImage ? (
              <motion.img
                key={roomIdx}
                src={roomImage}
                alt="room"
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            ) : (
              <motion.div
                key="empty"
                className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-950 flex flex-col items-center justify-center gap-3"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              >
                <Sparkles className="h-14 w-14 text-stone-700" />
                <p className="text-sm text-stone-600">ไม่มีงานแม่บ้านค้าง</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top gradient + header overlay */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none rounded-t-3xl" />
          <motion.div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-3.5"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
            <button className="flex items-center gap-2 rounded-xl bg-black/40 border border-white/15 backdrop-blur-md px-3 py-1.5 hover:bg-black/60 transition-colors">
              <MapPin className="h-3 w-3 text-stone-400" />
              <span className="text-xs font-medium text-stone-200">
                {activeRoom ? `ห้อง ${activeRoom.room.roomNumber}` : 'ไม่มีงานค้าง'}
              </span>
              {hkList.length > 1 && <ChevronDown className="h-3 w-3 text-stone-400" />}
            </button>
            <div className="flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md px-2.5 py-1.5" >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
              </span>
              <span className="text-[11px] text-stone-300 font-medium">Live</span>
            </div>
          </motion.div>

          {/* Bottom gradient + controls + room info overlay */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/75 to-transparent pointer-events-none rounded-b-3xl" />
          <motion.div className="absolute bottom-0 left-0 right-0 px-4 pb-4"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
            {/* Room info */}
            {activeRoom && (
              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className="text-white font-bold text-base leading-tight">ห้อง {activeRoom.room.roomNumber}</div>
                  <div className="text-white/55 text-xs mt-0.5">{activeRoom.room.zone?.name || activeRoom.room.roomType.name}</div>
                </div>
                <span className="rounded-full bg-amber-400/90 text-stone-900 text-[10px] font-bold px-2.5 py-1">
                  {activeRoom.status === 'in_progress' ? 'กำลังทำ' : 'รอทำ'}
                </span>
              </div>
            )}
            {/* Controls row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRoomIdx(i => Math.max(0, i - 1))}
                  disabled={roomIdx === 0 || hkList.length === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.12] backdrop-blur-sm text-stone-300 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setRoomIdx(i => Math.min(hkList.length - 1, i + 1))}
                  disabled={roomIdx >= hkList.length - 1 || hkList.length === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.12] backdrop-blur-sm text-stone-300 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <div className="flex gap-1 ml-1">
                  {hkList.slice(0, 6).map((_, i) => (
                    <button key={i} onClick={() => setRoomIdx(i)}
                      className={cn('h-1.5 rounded-full transition-all duration-200', i === roomIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/30')} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Link href="/housekeeping"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.12] backdrop-blur-sm text-stone-300 hover:bg-amber-400/30 hover:text-amber-300 transition-colors"
                  title="แม่บ้าน">
                  <Sparkles className="h-3.5 w-3.5" />
                </Link>
                <Link href="/room-map"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.12] backdrop-blur-sm text-stone-300 hover:bg-white/20 transition-colors"
                  title="ผังห้อง">
                  <Building2 className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        </GlassCard>

        {/* RIGHT — Stats (weather-like widget) */}
        <GlassCard delay={0.1}>
          {/* Top: mini ring (weather icon) + occupancy + date */}
          <div className="flex items-start gap-3 px-5 pt-5 pb-4">
            {/* Mini ring gauge — like the sun/cloud weather icon */}
            <MiniRing pct={occ?.occupancyPct ?? 0} />

            {/* Occupancy number */}
            <div className="flex-1">
              {isLoading ? <Skeleton className="h-10 w-20 mb-1" /> : (
                <motion.div className="text-5xl font-black text-stone-50 leading-none"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  {occPct}%
                </motion.div>
              )}
              <p className="text-xs text-stone-500 mt-1.5">Occupancy</p>
            </div>

            {/* Date — right side like weather */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-stone-300">{format(new Date(), 'EEEE', { locale: th })}</p>
              <p className="text-xs text-stone-500 mt-0.5">{format(new Date(), 'd MMMM yyyy', { locale: th })}</p>
              <div className="mt-2">
                {isLoading ? <Skeleton className="h-6 w-10 ml-auto" /> : (
                  <span className="text-2xl font-black text-stone-200">{occ?.available ?? 0}</span>
                )}
                <p className="text-[10px] text-stone-600">ห้องว่าง</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mx-5" />

          {/* Middle: 2 stats (humidity + wind speed equivalent) */}
          <div className="grid grid-cols-2 divide-x divide-white/[0.06] px-0 py-1">
            {[
              { icon: DoorOpen,  label: 'เช็คอิน',   val: dashboard?.arrivals,   color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
              { icon: DoorClosed, label: 'เช็คเอาท์', val: dashboard?.departures, color: 'text-amber-400',   bg: 'bg-amber-400/10'   },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3 px-5 py-4">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                  <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
                </div>
                <div>
                  {isLoading ? <Skeleton className="h-5 w-8" /> : (
                    <div className={`text-xl font-bold ${s.color}`}>{s.val ?? 0}</div>
                  )}
                  <div className="text-xs text-stone-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mx-5" />

          {/* Bottom: 4 columns — forecast style with stagger */}
          <div className="grid grid-cols-4 px-2 py-4">
            {[
              { label: 'เข้าพัก', val: occ?.occupied,                  icon: BedDouble, color: 'text-rose-400'    },
              { label: 'ว่าง',    val: occ?.available,                  icon: BedDouble, color: 'text-emerald-400' },
              { label: 'แม่บ้าน', val: dashboard?.pendingHousekeeping,  icon: Sparkles,  color: 'text-sky-400'     },
              { label: 'OOO',     val: occ?.outOfOrder,                 icon: Wrench,    color: 'text-stone-500'   },
            ].map((s, i) => (
              <motion.div key={s.label} className="flex flex-col items-center gap-1.5 text-center"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.25 }}>
                <span className="text-[11px] text-stone-600 font-medium">{s.label}</span>
                <s.icon className={cn('h-5 w-5', s.color)} />
                {isLoading ? <Skeleton className="h-4 w-5" /> : (
                  <span className={cn('text-sm font-bold', s.color)}>{s.val ?? 0}</span>
                )}
              </motion.div>
            ))}
          </div>
        </GlassCard>

        </div>{/* end ROW 1 sub-grid */}

        {/* ═══════════════════════════════════════════════ */}
        {/* ROW 2                                          */}
        {/* ═══════════════════════════════════════════════ */}

        {/* Occupancy Gauge — col 3 (AC-like) */}
        <GlassCard className="col-span-6 xl:col-span-3" delay={0.15}>
          <div className="flex items-center justify-between px-4 pt-4 pb-0">
            <div>
              <p className="text-sm font-semibold text-stone-200">สถานะห้อง</p>
              <p className="text-[10px] text-stone-500 mt-0.5">{occ?.totalRooms ?? 0} ห้องทั้งหมด</p>
            </div>
            <Link href="/room-map" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-stone-500 hover:bg-white/[0.12] hover:text-stone-300 transition-colors text-xs">→</Link>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-10"><Skeleton className="h-32 w-32 rounded-full" /></div>
          ) : (
            <OccupancyGauge pct={occPct} occupied={occ?.occupied ?? 0} available={occ?.available ?? 0} ooo={occ?.outOfOrder ?? 0} />
          )}
        </GlassCard>

        {/* Arrivals + Departures stacked — col 4 (TV + LED-like) */}
        <div className="col-span-12 md:col-span-6 xl:col-span-4 flex flex-col gap-3">
          {/* Arrivals (taller) */}
          <GlassCard delay={0.2}>
            <div className="flex items-center justify-between px-4 pt-4 pb-1">
              <div>
                <p className="text-sm font-semibold text-stone-200 flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-emerald-400" /> เช็คอิน
                  {arrList.length > 0 && <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">{arrList.length}</span>}
                </p>
                <p className="text-[10px] text-stone-500 mt-0.5">วันนี้</p>
              </div>
              <Link href="/bookings?status=confirmed" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-stone-500 hover:bg-white/[0.12] hover:text-stone-300 transition-colors text-xs">→</Link>
            </div>
            <div className="pt-1 pb-1.5">
              {arrList.length === 0 ? (
                <div className="flex items-center justify-center py-4 gap-2 text-stone-700">
                  <DoorOpen className="h-5 w-5" /><span className="text-xs">ไม่มีเช็คอินวันนี้</span>
                </div>
              ) : arrList.slice(0, 3).map((b, i) => <BookingRow key={b.id} b={b} type="in" index={i} />)}
            </div>
          </GlassCard>

          {/* Departures (shorter) */}
          <GlassCard delay={0.25}>
            <div className="flex items-center justify-between px-4 pt-4 pb-1">
              <div>
                <p className="text-sm font-semibold text-stone-200 flex items-center gap-2">
                  <DoorClosed className="h-4 w-4 text-amber-400" /> เช็คเอาท์
                  {depList.length > 0 && <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">{depList.length}</span>}
                </p>
                <p className="text-[10px] text-stone-500 mt-0.5">วันนี้</p>
              </div>
              <Link href="/bookings?status=checked_in" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-stone-500 hover:bg-white/[0.12] hover:text-stone-300 transition-colors text-xs">→</Link>
            </div>
            <div className="pt-1 pb-1.5">
              {depList.length === 0 ? (
                <div className="flex items-center justify-center py-4 gap-2 text-stone-700">
                  <DoorClosed className="h-5 w-5" /><span className="text-xs">ไม่มีเช็คเอาท์วันนี้</span>
                </div>
              ) : depList.slice(0, 3).map((b, i) => <BookingRow key={b.id} b={b} type="out" index={i} />)}
            </div>
          </GlassCard>
        </div>

        {/* HK + OOO mini stacked — col 2 (Alexa + WiFi-like) */}
        <div className="col-span-6 md:col-span-3 xl:col-span-2 flex flex-col gap-3">
          <GlassCard delay={0.28} className="flex-1">
            <div className="flex flex-col items-center justify-center h-full py-5 px-3 gap-2">
              <div className="flex items-center justify-between w-full px-1 mb-1">
                <Sparkles className="h-4 w-4 text-sky-400" />
                <Link href="/housekeeping" className="text-[10px] text-stone-600 hover:text-sky-400">ดู →</Link>
              </div>
              {isLoading ? <Skeleton className="h-9 w-12" /> : (
                <div className="text-4xl font-black text-stone-50">{hkCount}</div>
              )}
              <div className="text-xs text-stone-500 text-center">งานแม่บ้านค้าง</div>
            </div>
          </GlassCard>
          <GlassCard delay={0.3} className="flex-1">
            <div className="flex flex-col items-center justify-center h-full py-5 px-3 gap-2">
              <div className="flex items-center justify-between w-full px-1 mb-1">
                <Wrench className="h-4 w-4 text-rose-400" />
                <Link href="/maintenance" className="text-[10px] text-stone-600 hover:text-rose-400">ดู →</Link>
              </div>
              {isLoading ? <Skeleton className="h-9 w-12" /> : (
                <div className="text-4xl font-black text-stone-50">{oooCount}</div>
              )}
              <div className="text-xs text-stone-500 text-center">ห้อง OOO</div>
            </div>
          </GlassCard>
        </div>

        {/* Revenue — col 3 (Music player-like, tall) */}
        <GlassCard className="col-span-6 md:col-span-3 xl:col-span-3" delay={0.32}>
          {/* Artist/song style — title inline */}
          <div className="flex items-center justify-between px-4 pt-4 pb-0">
            <div>
              <p className="text-sm font-semibold text-stone-200">รายได้วันนี้</p>
              <p className="text-[10px] text-stone-500 mt-0.5">{rev?.transactionCount ?? 0} รายการ</p>
            </div>
            <Link href="/reports" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-stone-500 hover:bg-white/[0.12] hover:text-stone-300 transition-colors text-xs">→</Link>
          </div>
          <div className="px-4 pt-3 pb-2">
            {isLoading ? <Skeleton className="h-8 w-32" /> : (
              <motion.div className="text-2xl font-black text-stone-50 leading-tight"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                {formatCurrency(revAmount)}
              </motion.div>
            )}
          </div>

          {/* Album art equivalent — payment breakdown bars */}
          <div className="px-4 pb-4 mt-2 space-y-2.5">
            {PAYMENT_METHODS.map(m => {
              const amt = rev?.byMethod?.[m.key] ?? 0
              const pct = (rev?.totalGross ?? 0) > 0 ? Math.round((amt / rev.totalGross) * 100) : 0
              return (
                <div key={m.key}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-stone-500">{m.label}</span>
                    <span className="text-stone-400 font-medium">{formatCurrency(amt)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.08]">
                    <motion.div
                      key={`${m.key}-${pct}`}
                      className={`h-full rounded-full ${m.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, delay: 0.4, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Total bar */}
          {(rev?.totalGross ?? 0) > 0 && (
            <div className="border-t border-white/[0.06] px-4 py-3">
              <div className="flex justify-between text-[11px] text-stone-600 mb-1.5">
                <span>รวมทั้งหมด</span>
                <span className="text-stone-400 font-medium">{formatCurrency(rev?.totalGross ?? 0)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.08]">
                <motion.div
                  key={`total-${rev?.totalGross}`}
                  className="h-full rounded-full bg-amber-400"
                  initial={{ width: 0 }} animate={{ width: '100%' }}
                  transition={{ duration: 1, delay: 0.6 }}
                />
              </div>
            </div>
          )}
        </GlassCard>


      </div>
    </AppShell>
  )
}
