'use client'

import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface PmsDialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showLogo?: boolean
}

export function PmsDialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = 'md',
  showLogo = true,
}: PmsDialogProps) {
  const maxW = {
    sm:   'sm:max-w-md',
    md:   'sm:max-w-lg',
    lg:   'sm:max-w-2xl',
    xl:   'sm:max-w-3xl',
    full: 'sm:max-w-4xl',
  }[size]

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />

        <DialogPrimitive.Content
          className={cn(
            // Positioning & sizing
            'fixed left-[50%] top-[50%] z-50',
            'w-full translate-x-[-50%] translate-y-[-50%]',
            maxW,
            // Visual
            'sm:rounded-2xl border border-white/15 bg-black/55 backdrop-blur-2xl',
            'shadow-[0_24px_80px_rgba(0,0,0,0.65)] text-stone-100',
            'focus:outline-none',
            // Mobile: full bottom sheet feel
            'max-h-[90vh] overflow-y-auto',
            className
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* Close — minimal X */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 p-1 text-stone-500 hover:text-stone-200 transition-colors"
            aria-label="ปิด"
          >
            <X className="h-[18px] w-[18px]" />
          </button>

          <div className="p-6">
            {/* Logo */}
            {showLogo && (
              <div className="mb-3 flex justify-center">
                <div className="relative h-8 w-24">
                  <Image src="/images/logo.png" alt="Serene PMS" fill className="object-contain" />
                </div>
              </div>
            )}

            {/* Title */}
            <DialogPrimitive.Title className="text-center text-lg font-semibold text-stone-100">
              {title}
            </DialogPrimitive.Title>

            {/* Description */}
            {description && (
              <DialogPrimitive.Description className="mt-1.5 text-center text-sm text-stone-500 leading-relaxed">
                {description}
              </DialogPrimitive.Description>
            )}

            {/* Divider */}
            <div className="my-5 border-t border-white/[0.08]" />

            {/* Body */}
            <div>{children}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
