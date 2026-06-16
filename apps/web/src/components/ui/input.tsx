import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
  hint?: string
  labelRequired?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, hint, labelRequired, id, required, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`
    const isRequired = labelRequired || required
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 flex items-center gap-1 text-sm font-medium text-stone-300">
            {label}
            {isRequired && <span className="text-rose-400 text-xs leading-none">*</span>}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          required={required}
          className={cn(
            'flex h-10 w-full rounded-xl border bg-black/25 px-3 py-2 text-sm text-stone-100 transition-colors',
            'placeholder:text-stone-500',
            'focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-300/40',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-rose-400/50 focus:border-rose-400/70 focus:ring-rose-400/20'
              : 'border-white/15 hover:border-white/25',
            'backdrop-blur-sm',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1.5 flex items-center gap-1 text-xs text-rose-400"><span>⚠</span>{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-stone-600">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
