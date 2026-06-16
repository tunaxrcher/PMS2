import React from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: LucideIcon
  trend?: { value: number; label?: string }
  className?: string
  variant?: 'default' | 'amber' | 'emerald' | 'rose' | 'sky'
}

const variantStyles = {
  default: {
    icon: 'border-amber-300/20 bg-amber-400/15 text-amber-200',
    value: 'text-stone-50',
  },
  amber: {
    icon: 'border-amber-300/30 bg-amber-400/20 text-amber-200',
    value: 'text-amber-100',
  },
  emerald: {
    icon: 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200',
    value: 'text-emerald-100',
  },
  rose: {
    icon: 'border-rose-300/30 bg-rose-400/15 text-rose-200',
    value: 'text-rose-100',
  },
  sky: {
    icon: 'border-sky-300/30 bg-sky-400/15 text-sky-200',
    value: 'text-sky-100',
  },
}

export function StatCard({ label, value, subtext, icon: Icon, trend, className, variant = 'default' }: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <div className={cn('rounded-2xl border border-white/15 bg-white/[0.08] p-5 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.30)]', className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-400 truncate">{label}</p>
          <p className={cn('mt-1 text-3xl font-semibold tracking-tight', styles.value)}>{value}</p>
          {subtext && <p className="mt-1 text-xs text-stone-500">{subtext}</p>}
          {trend != null && (
            <div className={cn('mt-2 flex items-center gap-1 text-xs', trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-stone-500">{trend.label}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border', styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  )
}
