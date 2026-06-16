'use client'

import React from 'react'
import { motion } from 'framer-motion'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import Image from 'next/image'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

type ConfirmVariant = 'default' | 'danger' | 'success' | 'warning'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  variant?: ConfirmVariant
}

const variantConfig: Record<ConfirmVariant, { icon: React.ElementType; iconClass: string; confirmClass: string }> = {
  default: { icon: Info, iconClass: 'text-amber-300 bg-amber-400/15 border-amber-300/20', confirmClass: '' },
  danger: { icon: AlertTriangle, iconClass: 'text-rose-300 bg-rose-400/15 border-rose-300/20', confirmClass: 'bg-rose-500/80 hover:bg-rose-400 text-white shadow-rose-950/30' },
  success: { icon: CheckCircle2, iconClass: 'text-emerald-300 bg-emerald-400/15 border-emerald-300/20', confirmClass: 'bg-emerald-500 hover:bg-emerald-400 text-white' },
  warning: { icon: AlertTriangle, iconClass: 'text-amber-300 bg-amber-400/15 border-amber-300/20', confirmClass: '' },
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'ยืนยัน', cancelLabel = 'ยกเลิก',
  loading = false, variant = 'default',
}: ConfirmDialogProps) {
  const { icon: Icon, iconClass, confirmClass } = variantConfig[variant]

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </DialogPrimitive.Overlay>

        <DialogPrimitive.Content
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          asChild
        >
          <motion.div
            className="fixed left-[50%] top-[50%] z-50 w-full sm:max-w-sm translate-x-[-50%] translate-y-[-50%] sm:rounded-2xl border border-white/15 bg-black/55 backdrop-blur-2xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)] text-stone-100 focus:outline-none"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Close button — minimal */}
            <button onClick={onClose}
              className="absolute right-4 top-4 p-1 text-stone-500 hover:text-stone-200 transition-colors">
              <X className="h-4 w-4" />
            </button>

            {/* Logo */}
            <div className="mb-4 flex justify-center">
              <div className="relative h-8 w-28">
                <Image src="/images/logo.png" alt="Serene PMS" fill className="object-contain" />
              </div>
            </div>

            {/* Icon */}
            <div className="mb-4 flex justify-center">
              <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl border', iconClass)}>
                <Icon className="h-7 w-7" />
              </div>
            </div>

            {/* Content */}
            <DialogPrimitive.Title className="text-center text-lg font-semibold text-stone-100 mb-2">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-center text-sm text-stone-400 mb-6">
                {description}
              </DialogPrimitive.Description>
            )}

            {/* Actions */}
            <Button
              onClick={onConfirm}
              loading={loading}
              className={cn('w-full h-11', confirmClass)}
            >
              {confirmLabel}
            </Button>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
