'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { error?: string; label?: string }
>(({ className, children, error, label, id, ...props }, ref) => (
  <div className="w-full">
    {label && (
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1 text-sm font-medium text-stone-300">
        {label}
      </label>
    )}
    <SelectPrimitive.Trigger
      id={id}
      ref={ref}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-xl border bg-black/25 px-3 py-2 text-sm text-stone-100',
        'focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-300/40',
        'placeholder:text-stone-500 disabled:cursor-not-allowed disabled:opacity-50',
        error ? 'border-rose-400/50' : 'border-white/15 hover:border-white/25',
        'backdrop-blur-sm',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 text-stone-500" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
  </div>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden rounded-2xl border border-white/15 bg-black/70 backdrop-blur-2xl text-stone-100 shadow-2xl',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1.5">
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-xl py-2 pl-3 pr-8 text-sm text-stone-300 outline-none',
      'focus:bg-white/[0.08] focus:text-stone-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-amber-300" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('py-1.5 pl-3 pr-2 text-xs font-semibold text-stone-500 uppercase tracking-wider', className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel }
