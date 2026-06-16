'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import Image from 'next/image'
import { X, Building2, MapPin, Layers, BedDouble, Users, Tag, Ticket, Key } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

const settingsGroups = [
  {
    title: 'ที่พัก',
    items: [
      { href: '/settings/property', icon: Building2, label: 'ข้อมูลที่พัก', desc: 'ชื่อ, ที่อยู่, เวลา, ภาษี' },
      { href: '/settings/zones', icon: MapPin, label: 'โซน', desc: 'จัดการพื้นที่และโซน' },
      { href: '/settings/room-types', icon: Layers, label: 'ประเภทห้อง', desc: 'ประเภทและราคาห้องพัก' },
      { href: '/settings/rooms', icon: BedDouble, label: 'ห้องพัก', desc: 'จัดการห้องพักทั้งหมด' },
    ],
  },
  {
    title: 'ราคาและการจอง',
    items: [
      { href: '/settings/rate-plans', icon: Tag, label: 'Rate Plans', desc: 'แผนราคาและนโยบาย' },
      { href: '/settings/booking-sources', icon: Ticket, label: 'ช่องทางการจอง', desc: 'Walk-in, OTA, Direct' },
    ],
  },
  {
    title: 'บัญชีผู้ใช้',
    items: [
      { href: '/settings/users', icon: Users, label: 'ผู้ใช้งาน', desc: 'จัดการบัญชีพนักงาน', adminOnly: true },
      { href: '/settings/change-pin', icon: Key, label: 'เปลี่ยน PIN', desc: 'อัปเดต PIN ของคุณ' },
    ],
  },
]

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const router = useRouter()
  const { isAdmin } = useAuth()

  const navigate = (href: string) => {
    onClose()
    router.push(href)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </DialogPrimitive.Overlay>

        <DialogPrimitive.Content
          onPointerDownOutside={onClose}
          onEscapeKeyDown={onClose}
          asChild
        >
          <motion.div
            className="fixed left-[50%] top-[50%] z-50 w-full sm:max-w-2xl translate-x-[-50%] translate-y-[-50%] sm:rounded-2xl border border-white/15 bg-black/55 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.65)] text-stone-100 focus:outline-none"
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Close — minimal */}
            <button onClick={onClose}
              className="absolute right-4 top-4 p-1 text-stone-500 hover:text-stone-200 transition-colors z-10">
              <X className="h-4 w-4" />
            </button>

            <div className="p-6">
              {/* Logo + title */}
              <div className="mb-5 flex flex-col items-center gap-3">
                <div className="relative h-8 w-28">
                  <Image src="/images/logo.png" alt="Serene PMS" fill className="object-contain" />
                </div>
                <DialogPrimitive.Title className="text-lg font-semibold text-stone-100">
                  ตั้งค่าระบบ
                </DialogPrimitive.Title>
              </div>

              {/* Settings groups */}
              <div className="space-y-5">
                {settingsGroups.map(group => (
                  <div key={group.title}>
                    <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-stone-600">
                      {group.title}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items
                        .filter(item => !('adminOnly' in item) || !item.adminOnly || isAdmin)
                        .map((item, i) => (
                          <motion.button
                            key={item.href}
                            onClick={() => navigate(item.href)}
                            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left hover:border-amber-300/25 hover:bg-amber-400/[0.07] transition-all group"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 + 0.1 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/15 text-amber-300 group-hover:bg-amber-400/25 transition-colors">
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-stone-200 group-hover:text-stone-100">{item.label}</div>
                              <div className="text-xs text-stone-600 truncate">{item.desc}</div>
                            </div>
                          </motion.button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
