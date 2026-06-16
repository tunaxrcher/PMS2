'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { Receipt, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { GlassPanel } from '@/components/ui/glass-panel'
import { EmptyState } from '@/components/ui/empty-state'

// Folios page redirects to bookings since folios are part of booking detail
export default function FoliosPage() {
  return (
    <AppShell title="บิล & ชำระเงิน" subtitle="จัดการบิลและการชำระเงินผ่านหน้าการจอง">
      <GlassPanel padding="lg">
        <EmptyState
          icon={Receipt}
          title="บิลและการชำระเงิน"
          description="บิล (Folio) จะอยู่ในหน้าการจองแต่ละรายการ กรุณาเข้าไปดูในหน้าการจอง"
          action={
            <Link href="/bookings" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-medium text-stone-950 hover:bg-amber-300 transition-colors">
              ไปหน้าการจอง <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </GlassPanel>
    </AppShell>
  )
}
