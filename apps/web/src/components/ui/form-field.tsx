import React from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  success?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, required, error, hint, success, children, className }: FormFieldProps) {
  return (
    <div className={cn('w-full', className)}>
      <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-stone-300">
        {label}
        {required && <span className="text-rose-400 leading-none">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-rose-400">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}
      {success && !error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
          {success}
        </p>
      )}
      {hint && !error && !success && (
        <p className="mt-1.5 text-xs text-stone-600">{hint}</p>
      )}
    </div>
  )
}
