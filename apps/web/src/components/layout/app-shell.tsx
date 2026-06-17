'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { AppBackground } from './app-background'
import { AppHeader } from './app-header'

interface AppShellProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  headerActions?: React.ReactNode
}

export function AppShell({ children, title, subtitle, headerActions }: AppShellProps) {
  const pathname = usePathname()

  return (
    <AppBackground>
      <div className="flex h-screen flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          <motion.div
            className="min-h-full pt-8 pb-10 px-6 xl:px-0 xl:max-w-[1400px] xl:mx-auto 2xl:max-w-[1600px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            key={pathname}
          >
            {(title || subtitle || headerActions) && (
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  {title && <h1 className="text-xl font-semibold text-stone-100 leading-tight">{title}</h1>}
                  {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
                </div>
                {headerActions && <div className="flex-shrink-0">{headerActions}</div>}
              </div>
            )}
            {children}
          </motion.div>
        </main>
      </div>
    </AppBackground>
  )
}
