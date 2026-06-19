'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ViewOption<T extends string> {
  value: T
  label: string
  icon: LucideIcon
}

interface ViewToggleProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: ViewOption<T>[]
  className?: string
}

/** Small segmented control for switching between list/board/grid views. */
export function ViewToggle<T extends string>({ value, onChange, options, className }: ViewToggleProps<T>) {
  return (
    <div className={cn('flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/25 p-0.5', className)}>
      {options.map(opt => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            title={opt.label}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all border',
              active
                ? 'bg-amber-400/15 text-amber-200 border-amber-300/20'
                : 'text-stone-500 hover:text-stone-300 border-transparent',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
