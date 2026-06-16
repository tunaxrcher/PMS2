'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { SettingsDialog } from './settings-dialog'
import {
  LayoutDashboard,
  CalendarRange,
  BookOpen,
  Users,
  Sparkles,
  Wrench,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { useAuth } from '@/hooks/use-auth'
import { authApi } from '@/lib/api'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  badge?: number
  permission?: string
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: 'MAIN',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'ภาพรวม' },
      { href: '/room-grid', icon: CalendarRange, label: 'ปฏิทินห้องพัก' },
      { href: '/bookings', icon: BookOpen, label: 'การจอง' },
      { href: '/guests', icon: Users, label: 'ลูกค้า' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { href: '/housekeeping', icon: Sparkles, label: 'แม่บ้าน' },
      { href: '/maintenance', icon: Wrench, label: 'แจ้งซ่อม' },
      { href: '/folios', icon: Receipt, label: 'บิล & ชำระเงิน' },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { href: '/reports', icon: BarChart3, label: 'รายงาน' },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, logout, hasPermission } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    logout()
    window.location.href = '/login'
  }

  return (
    <>
    <div
      className={cn(
        'relative flex h-full flex-col transition-all duration-300',
        sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Glass sidebar */}
      <div className="absolute inset-0 rounded-r-3xl border-r border-white/10 bg-black/30 backdrop-blur-2xl shadow-[20px_0_80px_rgba(0,0,0,0.35)]" />

      <div className="relative flex h-full flex-col">
        {/* Logo area */}
        <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-white/10', sidebarCollapsed && 'justify-center px-2')}>
          <div className="relative h-9 w-9 flex-shrink-0">
            <Image src="/images/logo.png" alt="Serene PMS" fill className="object-contain" priority />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-stone-100 leading-tight truncate">Serene PMS</div>
              <div className="text-xs text-stone-500 truncate">{user?.property?.name || 'Loading...'}</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-5">
              {!sidebarCollapsed && (
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-stone-600">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                        sidebarCollapsed && 'justify-center px-0 py-3',
                        isActive
                          ? 'bg-amber-400/15 text-amber-100 border border-amber-300/20 shadow-sm'
                          : 'text-stone-400 hover:bg-white/[0.06] hover:text-stone-100'
                      )}
                    >
                      {isActive && !sidebarCollapsed && (
                        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-amber-400" />
                      )}
                      <item.icon
                        className={cn(
                          'flex-shrink-0 transition-colors',
                          sidebarCollapsed ? 'h-5 w-5' : 'h-4 w-4',
                          isActive ? 'text-amber-300' : 'text-stone-500 group-hover:text-stone-300'
                        )}
                      />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      {!sidebarCollapsed && item.badge != null && item.badge > 0 && (
                        <span className="ml-auto rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Settings button */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setSettingsOpen(true)}
            title={sidebarCollapsed ? 'ตั้งค่า' : undefined}
            className={cn(
              'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
              sidebarCollapsed && 'justify-center px-0 py-3',
              pathname.startsWith('/settings')
                ? 'bg-amber-400/15 text-amber-100 border border-amber-300/20 shadow-sm'
                : 'text-stone-400 hover:bg-white/[0.06] hover:text-stone-100'
            )}
          >
            {pathname.startsWith('/settings') && !sidebarCollapsed && (
              <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-amber-400" />
            )}
            <Settings className={cn('flex-shrink-0 transition-colors', sidebarCollapsed ? 'h-5 w-5' : 'h-4 w-4', pathname.startsWith('/settings') ? 'text-amber-300' : 'text-stone-500 group-hover:text-stone-300')} />
            {!sidebarCollapsed && <span className="truncate">ตั้งค่า</span>}
          </button>
        </div>

        {/* User area */}
        <div className="border-t border-white/10 p-3">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.05] px-3 py-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-xs font-semibold text-amber-300">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-stone-200 truncate">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-stone-500 truncate">
                  {user?.roles?.[0] === 'admin' ? 'ผู้ดูแลระบบ' : user?.roles?.[0] === 'front_desk' ? 'พนักงานต้อนรับ' : 'แม่บ้าน'}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex-shrink-0 rounded-lg p-1.5 text-stone-500 hover:bg-white/10 hover:text-stone-300 transition-colors"
                title="ออกจากระบบ"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center rounded-xl py-2.5 text-stone-500 hover:bg-white/10 hover:text-rose-400 transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-stone-900/80 text-stone-400 hover:text-stone-100 backdrop-blur-sm transition-colors z-20"
        >
          {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>
    </div>

    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
