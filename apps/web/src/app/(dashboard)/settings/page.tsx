'use client'

import React from 'react'
import Link from 'next/link'
import { Building2, BedDouble, Users, Tag, Ticket } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { useAuth } from '@/hooks/use-auth'

const settingsGroups = [
  {
    title: 'ที่พัก',
    items: [
      { href: '/settings/property', icon: Building2, label: 'ข้อมูลที่พัก', desc: 'ตั้งค่าข้อมูลพื้นฐานและภาพพื้นหลัง' },
      { href: '/settings/rooms', icon: BedDouble, label: 'จัดการห้องพัก', desc: 'โซน · ประเภทห้อง · ห้องพัก ในหน้าเดียว' },
    ],
  },
  {
    title: 'ราคาและการจอง',
    items: [
      { href: '/settings/rate-plans', icon: Tag, label: 'Rate Plans', desc: 'กำหนดแผนราคาและส่วนลด' },
      { href: '/settings/booking-sources', icon: Ticket, label: 'ช่องทางการจอง', desc: 'Walk-in, OTA, Direct' },
    ],
  },
  {
    title: 'ผู้ใช้งาน',
    items: [
      { href: '/settings/users', icon: Users, label: 'ผู้ใช้งาน', desc: 'จัดการบัญชีพนักงาน' },
    ],
  },
]

export default function SettingsPage() {
  const { isAdmin } = useAuth()

  return (
    <AppShell title="ตั้งค่า" subtitle="จัดการข้อมูลและการตั้งค่าระบบ">
      <div className="space-y-6">
        {settingsGroups.map((group) => (
          <div key={group.title}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">{group.title}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href}>
                  <GlassPanel
                    padding="md"
                    className="cursor-pointer hover:border-amber-300/25 hover:bg-amber-400/5 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/15 text-amber-300 group-hover:bg-amber-400/20 transition-colors">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-stone-200 group-hover:text-stone-100">{item.label}</div>
                        <div className="text-xs text-stone-500 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                  </GlassPanel>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
