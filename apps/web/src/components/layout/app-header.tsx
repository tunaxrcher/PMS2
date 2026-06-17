'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell, Search, ChevronDown, Key, LogOut, X,
  BookOpen, Users, BedDouble, Clock, Sparkles, Wrench,
  CheckCircle2, LayoutDashboard, CalendarRange, Receipt,
  BarChart3, Settings, Building2,
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Popover from '@radix-ui/react-popover'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/use-auth'
import { authApi, bookingsApi, guestsApi, reportsApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { cn, formatDate } from '@/lib/utils'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { toast } from 'sonner'
import { SettingsDialog } from './settings-dialog'

// ── Nav items ──────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'ภาพรวม'   },
  { href: '/room-map',     icon: Building2,       label: 'ผังห้อง'  },
  { href: '/room-grid',    icon: CalendarRange,   label: 'ปฏิทิน'   },
  { href: '/bookings',     icon: BookOpen,        label: 'การจอง'   },
  { href: '/guests',       icon: Users,           label: 'ลูกค้า'   },
  { href: '/housekeeping', icon: Sparkles,        label: 'แม่บ้าน'  },
  { href: '/maintenance',  icon: Wrench,          label: 'แจ้งซ่อม' },
  { href: '/folios',       icon: Receipt,         label: 'บิล'       },
  { href: '/reports',      icon: BarChart3,       label: 'รายงาน'   },
]

// ── Search Modal ────────────────────────────────────────
function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: bookings } = useQuery({
    queryKey: ['search-bookings', query],
    queryFn: () => bookingsApi.list({ guestName: query, limit: 4 }).then(r => r.data),
    enabled: query.length >= 2,
    staleTime: 10_000,
  })

  const { data: guests } = useQuery({
    queryKey: ['search-guests', query],
    queryFn: () => guestsApi.search(query).then(r => r.data),
    enabled: query.length >= 2,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
    else setQuery('')
  }, [open])

  const navigate = (href: string) => { router.push(href); onClose() }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4" onClick={onClose}>
      <motion.div className="w-full max-w-xl"
        initial={{ opacity: 0, y: -20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-black/70 backdrop-blur-2xl px-4 py-3 shadow-2xl">
          <Search className="h-4 w-4 text-stone-500 flex-shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="ค้นหาลูกค้า, การจอง, เลขห้อง..."
            className="flex-1 bg-transparent text-stone-100 placeholder:text-stone-600 outline-none text-sm" />
          {query && <button onClick={() => setQuery('')} className="text-stone-600 hover:text-stone-400"><X className="h-4 w-4" /></button>}
          <kbd className="hidden sm:block text-[10px] text-stone-700 border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {query.length >= 2 && (
          <motion.div className="mt-2 rounded-2xl border border-white/15 bg-black/75 backdrop-blur-2xl overflow-hidden shadow-2xl"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
            {(bookings?.bookings?.length > 0) && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-stone-600 border-b border-white/5">
                  <BookOpen className="h-3 w-3" /> การจอง
                </div>
                {(bookings.bookings as Array<{ id: string; bookingNumber: string; guest: { firstName: string; lastName: string }; checkInDate: string }>).map(b => (
                  <button key={b.id} onClick={() => navigate(`/bookings/${b.id}`)}
                    className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left">
                    <div><span className="text-xs font-mono text-amber-400">{b.bookingNumber}</span>
                      <span className="ml-3 text-sm text-stone-200">{b.guest.firstName} {b.guest.lastName}</span></div>
                    <span className="text-xs text-stone-600">{formatDate(b.checkInDate, 'dd/MM/yy')}</span>
                  </button>
                ))}
              </div>
            )}
            {(guests as unknown[])?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-stone-600 border-b border-white/5">
                  <Users className="h-3 w-3" /> ลูกค้า
                </div>
                {(guests as Array<{ id: string; firstName: string; lastName: string; phone?: string | null }>).slice(0, 4).map(g => (
                  <button key={g.id} onClick={() => navigate(`/guests/${g.id}`)}
                    className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left">
                    <span className="text-sm text-stone-200">{g.firstName} {g.lastName}</span>
                    <span className="text-xs text-stone-600">{g.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {query.length >= 2 && !bookings?.bookings?.length && !(guests as unknown[])?.length && (
              <div className="px-4 py-6 text-center text-sm text-stone-600">ไม่พบผลลัพธ์สำหรับ &ldquo;{query}&rdquo;</div>
            )}
          </motion.div>
        )}

        {query.length === 0 && (
          <div className="mt-2 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-2xl px-4 py-4">
            <p className="text-xs text-stone-600 mb-3">ทางลัด</p>
            <div className="grid grid-cols-3 gap-2">
              {[{ icon: BookOpen, label: 'การจอง', href: '/bookings' }, { icon: Users, label: 'ลูกค้า', href: '/guests' }, { icon: BedDouble, label: 'ห้องพัก', href: '/room-grid' }].map(s => (
                <button key={s.href} onClick={() => navigate(s.href)}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.04] p-3 hover:bg-white/[0.08] transition-colors">
                  <s.icon className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-stone-400">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ── PIN Input Row ────────────────────────────────────────
function PinInputRow({
  label, value, onChange, autoFocus, error
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  autoFocus?: boolean
  error?: string
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (autoFocus) setTimeout(() => refs.current[0]?.focus(), 80)
  }, [autoFocus])

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const arr = [...value]
    arr[i] = digit
    onChange(arr)
    if (digit && i < 5) setTimeout(() => refs.current[i + 1]?.focus(), 0)
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[i]) {
        const arr = [...value]; arr[i] = ''; onChange(arr)
      } else if (i > 0) {
        refs.current[i - 1]?.focus()
        const arr = [...value]; arr[i - 1] = ''; onChange(arr)
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const arr = Array(6).fill('')
    pasted.split('').forEach((d, i) => { arr[i] = d })
    onChange(arr)
    setTimeout(() => refs.current[Math.min(pasted.length, 5)]?.focus(), 0)
  }

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-stone-300 text-center">{label}</p>
      <div className="flex justify-center gap-3" onPaste={handlePaste}>
        {value.map((d, i) => (
          <input
            key={i}
            ref={el => { refs.current[i] = el }}
            type="password" inputMode="numeric" maxLength={1} value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`h-14 w-11 rounded-2xl border-2 text-center text-xl font-bold text-stone-100 bg-black/30 transition-all duration-150 focus:outline-none focus:scale-105 ${
              d ? 'border-amber-400/60 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.15)]' : 'border-white/15 hover:border-white/30'
            } focus:border-amber-400/80 focus:ring-2 focus:ring-amber-400/25`}
          />
        ))}
      </div>
      {error && <p className="mt-2 text-center text-xs text-rose-400">{error}</p>}
    </div>
  )
}

// ── Change PIN Dialog ───────────────────────────────────
function ChangePinDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'current' | 'new'>('current')
  const [current, setCurrent] = useState(Array(6).fill(''))
  const [newP, setNewP] = useState(Array(6).fill(''))
  const [confirm, setConfirm] = useState(Array(6).fill(''))
  const [saving, setSaving] = useState(false)
  const [currentError, setCurrentError] = useState('')
  const [newError, setNewError] = useState('')
  const { user } = useAuth()

  const reset = () => {
    setStep('current'); setCurrent(Array(6).fill('')); setNewP(Array(6).fill(''))
    setConfirm(Array(6).fill('')); setCurrentError(''); setNewError('')
  }

  const handleClose = () => { onClose(); setTimeout(reset, 300) }

  useEffect(() => {
    if (step === 'current' && current.join('').length === 6) setTimeout(() => setStep('new'), 200)
  }, [current, step])

  useEffect(() => {
    if (step === 'new' && confirm.join('').length === 6) setTimeout(() => handleSubmitNew(), 150)
  }, [confirm, step])

  const handleSubmitNew = async () => {
    const n = newP.join(''), c = confirm.join(''), cur = current.join('')
    if (n !== c) { setNewError('PIN ไม่ตรงกัน'); setConfirm(Array(6).fill('')); return }
    if (n === '000000') { setNewError('ไม่สามารถใช้ PIN เริ่มต้นได้'); setNewP(Array(6).fill('')); setConfirm(Array(6).fill('')); return }
    if (n === cur) { setNewError('PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม'); setNewP(Array(6).fill('')); setConfirm(Array(6).fill('')); return }
    setSaving(true); setNewError('')
    try {
      await authApi.changePin(cur, n, c)
      toast.success('เปลี่ยน PIN สำเร็จ')
      handleClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'เกิดข้อผิดพลาด'
      setNewError(msg); setNewP(Array(6).fill('')); setConfirm(Array(6).fill(''))
    } finally { setSaving(false) }
  }

  // suppress unused warning — user is accessed for context (future: show current user name)
  void user

  return (
    <PmsDialog open={open} onClose={handleClose} title="เปลี่ยน PIN"
      description={step === 'current' ? 'กรอก PIN ปัจจุบันเพื่อยืนยันตัวตน' : 'ตั้ง PIN ใหม่ 6 หลักสำหรับการ Login'}
      size="sm">
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {step === 'current' ? (
            <motion.div key="current" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <PinInputRow label="PIN ปัจจุบัน" value={current} onChange={val => { setCurrent(val); setCurrentError('') }} autoFocus error={currentError} />
              {current.join('').length === 6 && <p className="mt-3 text-center text-xs text-stone-500 animate-pulse">กำลังดำเนินการ...</p>}
            </motion.div>
          ) : (
            <motion.div key="new" className="space-y-5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
              <PinInputRow label="PIN ใหม่" value={newP} onChange={val => { setNewP(val); setNewError('') }} autoFocus />
              <PinInputRow label="ยืนยัน PIN ใหม่" value={confirm} onChange={val => { setConfirm(val); setNewError('') }} error={newError} />
              {saving && <p className="text-center text-xs text-stone-500 animate-pulse">กำลังบันทึก...</p>}
              <button onClick={() => { setStep('current'); setCurrent(Array(6).fill('')); setNewP(Array(6).fill('')); setConfirm(Array(6).fill('')) }}
                className="w-full text-center text-xs text-stone-600 hover:text-stone-400 transition-colors">
                ← ย้อนกลับ
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PmsDialog>
  )
}

// ── AppHeader (Top Nav) ─────────────────────────────────
export function AppHeader() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const [changePinOpen, setChangePinOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const today = format(new Date(), 'EEEE, d MMMM yyyy', { locale: th })

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard-noti'],
    queryFn: () => reportsApi.dashboard().then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const notifications = React.useMemo(() => {
    if (!dashboard) return []
    const items = []
    if (dashboard.arrivals > 0)            items.push({ icon: BedDouble, text: `มีลูกค้าเช็คอินรออยู่ ${dashboard.arrivals} ราย`,              color: 'text-emerald-400' })
    if (dashboard.pendingHousekeeping > 0) items.push({ icon: Sparkles, text: `งานทำความสะอาดค้าง ${dashboard.pendingHousekeeping} ห้อง`,     color: 'text-amber-400'  })
    if (dashboard.departures > 0)          items.push({ icon: Clock,    text: `มีลูกค้าเช็คเอาท์วันนี้ ${dashboard.departures} ราย`,           color: 'text-sky-400'    })
    if (dashboard.occupancy?.outOfOrder > 0) items.push({ icon: Wrench, text: `ห้อง Out of Order ${dashboard.occupancy.outOfOrder} ห้อง`,       color: 'text-rose-400'   })
    return items
  }, [dashboard])

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    logout()
    window.location.href = '/login'
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const roleLabel = user?.roles?.[0] === 'admin' ? 'ผู้ดูแลระบบ' : user?.roles?.[0] === 'front_desk' ? 'พนักงานต้อนรับ' : 'แม่บ้าน'

  return (
    <>
      <header className="flex-shrink-0 pt-3">

        {/* ── Row 1: Branding + User controls ── */}
        <div className="flex items-center justify-between px-6 py-4 xl:max-w-[1400px] xl:mx-auto 2xl:max-w-[1600px] w-full">

          {/* Logo + Property name */}
          <div className="flex items-center gap-2.5">
            <div className="relative h-8 w-8 flex-shrink-0">
              <Image src="/images/logo.png" alt="Serene PMS" fill className="object-contain" priority />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-stone-100">Serene PMS</div>
              <div className="text-[10px] text-stone-500">{user?.property?.name || '...'}</div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            <span className="hidden xl:block mr-2 text-xs text-stone-600">{today}</span>

            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              title="ค้นหา (⌘K)"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-stone-400 hover:bg-white/[0.10] hover:text-stone-200 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Notifications */}
            <Popover.Root>
              <Popover.Trigger asChild>
                <button className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-stone-400 hover:bg-white/[0.10] hover:text-stone-200 transition-colors">
                  <Bell className="h-4 w-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-stone-900">
                      {notifications.length}
                    </span>
                  )}
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content align="end" sideOffset={8}
                  className="z-[200] w-80 rounded-2xl border border-white/15 bg-black/80 backdrop-blur-2xl shadow-2xl p-2 text-stone-100">
                  <div className="px-3 py-2 border-b border-white/10 mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">การแจ้งเตือน</span>
                    <span className="text-[10px] text-stone-600">ข้อมูลวันนี้</span>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-6">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
                      <p className="text-sm text-stone-600">ทุกอย่างเรียบร้อย</p>
                    </div>
                  ) : (
                    notifications.map((n, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5">
                        <n.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${n.color}`} />
                        <p className="text-sm text-stone-300 leading-tight">{n.text}</p>
                      </div>
                    ))
                  )}
                  <div className="mt-1 pt-1 border-t border-white/10">
                    <Link href="/dashboard" className="block w-full text-center text-xs text-amber-400 hover:text-amber-300 py-1.5 transition-colors">
                      ดูภาพรวม →
                    </Link>
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            {/* User menu */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] pl-1 pr-2.5 py-1 hover:bg-white/[0.10] transition-colors outline-none">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/20 text-[10px] font-bold text-amber-300">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <span className="hidden sm:block text-stone-300 text-xs max-w-[80px] truncate">{user?.firstName}</span>
                  <ChevronDown className="h-3 w-3 text-stone-500" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8}
                  className="z-[200] w-52 rounded-2xl border border-white/15 bg-black/80 backdrop-blur-2xl p-1.5 shadow-2xl text-stone-100">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <div className="text-sm font-medium text-stone-200">{user?.firstName} {user?.lastName}</div>
                    <div className="text-[11px] text-stone-500">{user?.phone}</div>
                    <div className="text-[10px] text-amber-500/70 mt-0.5">{roleLabel}</div>
                  </div>
                  <DropdownMenu.Item onSelect={() => setChangePinOpen(true)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-stone-400 hover:bg-white/[0.08] hover:text-stone-100 transition-colors outline-none cursor-pointer">
                    <Key className="h-4 w-4" /> เปลี่ยน PIN
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => setSettingsOpen(true)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-stone-400 hover:bg-white/[0.08] hover:text-stone-100 transition-colors outline-none cursor-pointer">
                    <Settings className="h-4 w-4" /> ตั้งค่า
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-white/10" />
                  <DropdownMenu.Item onClick={handleLogout}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors outline-none cursor-pointer">
                    <LogOut className="h-4 w-4" /> ออกจากระบบ
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        {/* ── Row 2: Centered floating nav pill ── */}
        <div className="flex justify-center px-6 pt-1 pb-5">
          <nav className="flex items-center gap-0.5 overflow-x-auto rounded-2xl border border-white/[0.12] bg-black/35 backdrop-blur-sm px-1.5 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.45)] scrollbar-none">
            {NAV_ITEMS.map(item => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex flex-col items-center gap-0.5 rounded-xl px-3.5 py-1.5 transition-all duration-200 flex-shrink-0 border',
                    isActive
                      ? 'bg-amber-400/15 border-amber-300/25 shadow-[0_0_14px_rgba(251,191,36,0.15)]'
                      : 'border-transparent text-stone-500 hover:bg-white/[0.06] hover:text-stone-300'
                  )}
                >
                  <item.icon className={cn('h-[15px] w-[15px]', isActive ? 'text-amber-300' : 'text-stone-500 group-hover:text-stone-300')} />
                  <span className={cn('text-[10px] font-medium leading-none whitespace-nowrap', isActive ? 'text-amber-200' : 'group-hover:text-stone-300')}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>

      </header>

      {/* Modals & Dialogs */}
      <AnimatePresence>
        {searchOpen && <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
      </AnimatePresence>
      <ChangePinDialog open={changePinOpen} onClose={() => setChangePinOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
