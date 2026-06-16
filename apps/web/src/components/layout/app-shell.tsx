'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { AppBackground } from './app-background'
import { AppSidebar } from './app-sidebar'
import { AppHeader } from './app-header'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  headerActions?: React.ReactNode
}

export function AppShell({ children, title, subtitle, headerActions }: AppShellProps) {
  const { sidebarCollapsed } = useUIStore()

  return (
    <AppBackground>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="flex-shrink-0 h-full z-20">
          <AppSidebar />
        </div>

        {/* Main area */}
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
          <AppHeader title={title} subtitle={subtitle} actions={headerActions} />
          <main className="flex-1 overflow-y-auto">
            <motion.div
              className="h-full px-6 py-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              key={typeof window !== 'undefined' ? window.location.pathname : 'page'}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </AppBackground>
  )
}
