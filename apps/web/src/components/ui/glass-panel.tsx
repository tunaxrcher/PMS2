import React from 'react'
import { cn } from '@/lib/utils'

interface GlassPanelProps {
  children: React.ReactNode
  className?: string
  dense?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function GlassPanel({ children, className, dense = false, padding = 'md' }: GlassPanelProps) {
  const paddingClass = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }[padding]

  return (
    <div
      className={cn(
        'rounded-2xl border backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.30)]',
        dense
          ? 'border-white/15 bg-black/30'
          : 'border-white/15 bg-white/[0.08]',
        paddingClass,
        className
      )}
    >
      {children}
    </div>
  )
}

export function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/15 bg-white/[0.08] backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.30)]',
        className
      )}
    >
      {children}
    </div>
  )
}
