'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SearchToggleProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * A search icon that expands into a text input when clicked.
 * Collapses back when Escape is pressed or the field blurs while empty.
 */
export function SearchToggle({ value, onChange, placeholder = 'ค้นหา...', className }: SearchToggleProps) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus when opening
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Keep open as long as there's text
  const handleBlur = () => {
    if (!value) setOpen(false)
  }

  const handleClose = () => {
    onChange('')
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClose()
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="input"
            initial={{ width: 36, opacity: 0.6 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 36, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="relative flex items-center h-9 rounded-full border border-white/20 bg-black/30 backdrop-blur-sm focus-within:border-amber-300/40">
              <Search className="absolute left-3 h-3.5 w-3.5 text-stone-500 flex-shrink-0 pointer-events-none" />
              <input
                ref={inputRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="h-full w-full bg-transparent pl-8 pr-8 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none"
              />
              {value && (
                <button
                  onMouseDown={e => { e.preventDefault(); handleClose() }}
                  className="absolute right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-stone-600 hover:bg-stone-500 transition-colors"
                >
                  <X className="h-2.5 w-2.5 text-stone-300" />
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="icon"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(true)}
            title="ค้นหา"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-stone-400 hover:bg-white/[0.10] hover:text-stone-200 transition-colors"
          >
            <Search className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
