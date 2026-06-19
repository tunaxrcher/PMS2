'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatusChip } from '@/lib/room-status'

interface NamedEntity { id: string; name: string }

interface RoomFilterPanelProps {
  open: boolean
  onToggleOpen: () => void
  zones: NamedEntity[]
  roomTypes: NamedEntity[]
  zoneFilter: string
  onZoneFilter: (id: string) => void
  typeFilter: string
  onTypeFilter: (id: string) => void
  statusOptions: StatusChip[]
  statusFilters: string[]
  onToggleStatus: (key: string) => void
  activeCount: number
  onClearAll: () => void
}

const pillBase = 'rounded-full px-3 py-1 text-xs font-medium border transition-all'
const pillIdle = 'border-white/10 text-stone-500 hover:border-white/20 hover:text-stone-300'
const pillActive = 'bg-amber-400/15 border-amber-300/30 text-amber-200'

/**
 * Collapsible filter panel shared by /room-map and /room-grid so both pages keep
 * an identical filter UI. Zone/type are single-select (toggle), status is multi-select.
 */
export function RoomFilterPanel({
  open, onToggleOpen,
  zones, roomTypes,
  zoneFilter, onZoneFilter,
  typeFilter, onTypeFilter,
  statusOptions, statusFilters, onToggleStatus,
  activeCount, onClearAll,
}: RoomFilterPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm overflow-hidden">
      {/* Toggle bar */}
      <button
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Filter className="h-4 w-4 text-stone-500" />
          <span className="text-sm font-medium text-stone-400">ตัวกรอง</span>
          {activeCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-stone-900">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); onClearAll() }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClearAll() } }}
              className="text-xs text-stone-600 hover:text-rose-400 transition-colors cursor-pointer"
            >
              ล้างทั้งหมด ×
            </span>
          )}
          <ChevronRight className={cn('h-4 w-4 text-stone-600 transition-transform duration-200', open && 'rotate-90')} />
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] divide-y divide-white/[0.06]">
              {/* Zone */}
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 w-12 flex-shrink-0 pt-1">โซน</span>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => onZoneFilter('')} className={cn(pillBase, zoneFilter === '' ? pillActive : pillIdle)}>
                    ทั้งหมด
                  </button>
                  {zones.map(z => (
                    <button key={z.id} onClick={() => onZoneFilter(zoneFilter === z.id ? '' : z.id)}
                      className={cn(pillBase, zoneFilter === z.id ? pillActive : pillIdle)}>
                      {z.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Type */}
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 w-12 flex-shrink-0 pt-1">ประเภท</span>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => onTypeFilter('')} className={cn(pillBase, typeFilter === '' ? pillActive : pillIdle)}>
                    ทั้งหมด
                  </button>
                  {roomTypes.map(rt => (
                    <button key={rt.id} onClick={() => onTypeFilter(typeFilter === rt.id ? '' : rt.id)}
                      className={cn(pillBase, typeFilter === rt.id ? pillActive : pillIdle)}>
                      {rt.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status multi-select */}
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 w-12 flex-shrink-0 pt-1">สถานะ</span>
                <div className="flex flex-wrap gap-1.5">
                  {statusOptions.map(opt => {
                    const isSelected = statusFilters.includes(opt.key)
                    return (
                      <button key={opt.key} onClick={() => onToggleStatus(opt.key)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all',
                          isSelected ? `${opt.badgeSoft} border-transparent` : pillIdle
                        )}>
                        {isSelected ? (
                          <span className="text-xs font-black">✓</span>
                        ) : (
                          <span className={cn('h-2 w-2 rounded-full flex-shrink-0', opt.dot)} />
                        )}
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
