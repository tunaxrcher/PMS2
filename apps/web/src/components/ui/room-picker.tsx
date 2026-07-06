'use client'

import * as React from 'react'
import { Search, X, Check, DoorClosed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROOM_STATUS } from '@/lib/room-status'

export interface RoomPickerRoom {
  id: string
  roomNumber: string
  roomName?: string | null
  currentStatus?: string | null
  zone?: string | null
  roomType?: string | null
}

interface RoomPickerProps {
  rooms: RoomPickerRoom[]
  value: string
  onChange: (value: string) => void
  label?: string
  /** Show a "no specific room" chip that clears the selection */
  clearable?: boolean
  noneLabel?: string
}

export function RoomPicker({
  rooms,
  value,
  onChange,
  label,
  clearable,
  noneLabel = 'ไม่เฉพาะห้อง',
}: RoomPickerProps) {
  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter(r =>
      `${r.roomNumber} ${r.roomName ?? ''} ${r.zone ?? ''} ${r.roomType ?? ''}`.toLowerCase().includes(q)
    )
  }, [rooms, query])

  // Group by zone, preserving first-seen order
  const grouped = React.useMemo(() => {
    const map = new Map<string, RoomPickerRoom[]>()
    for (const r of filtered) {
      const key = r.zone || 'ไม่ระบุโซน'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return Array.from(map.entries())
  }, [filtered])

  // Status legend — only statuses actually present
  const legend = React.useMemo(() => {
    const seen = new Set<string>()
    for (const r of rooms) if (r.currentStatus) seen.add(r.currentStatus)
    return Array.from(seen).filter(s => ROOM_STATUS[s])
  }, [rooms])

  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-stone-300">{label}</label>
      )}

      {/* Search */}
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-3 backdrop-blur-sm focus-within:border-amber-300/40 focus-within:ring-2 focus-within:ring-amber-400/20">
        <Search className="h-4 w-4 flex-shrink-0 text-stone-500" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ค้นหาเลขห้อง / ชื่อ / โซน..."
          className="h-10 w-full bg-transparent text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="text-stone-500 hover:text-stone-200">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="max-h-[min(20rem,45vh)] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        {clearable && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={cn(
              'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
              value === ''
                ? 'border-amber-300/50 bg-amber-400/10 text-amber-200'
                : 'border-white/10 bg-white/[0.03] text-stone-400 hover:bg-white/[0.06]'
            )}
          >
            <DoorClosed className="h-4 w-4" />
            {noneLabel}
            {value === '' && <Check className="ml-auto h-4 w-4 text-amber-300" />}
          </button>
        )}

        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-stone-500">ไม่พบห้อง</div>
        ) : (
          grouped.map(([zone, zoneRooms]) => (
            <div key={zone}>
              <div className="mb-1.5 px-0.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
                {zone} <span className="text-stone-600">· {zoneRooms.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {zoneRooms.map(r => {
                  const st = r.currentStatus ? ROOM_STATUS[r.currentStatus] : undefined
                  const selected = r.id === value
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onChange(r.id)}
                      title={st?.label}
                      className={cn(
                        'relative flex flex-col items-start gap-1 rounded-xl border px-2.5 py-2 text-left transition-colors',
                        selected
                          ? 'border-amber-300/60 bg-amber-400/10 ring-1 ring-amber-300/40'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]'
                      )}
                    >
                      <span className="flex w-full items-center justify-between gap-1">
                        <span className="truncate text-sm font-bold text-stone-100">{r.roomNumber}</span>
                        {st ? (
                          <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', st.dot)} />
                        ) : (
                          selected && <Check className="h-3.5 w-3.5 text-amber-300" />
                        )}
                      </span>
                      <span className="w-full truncate text-[0.6875rem] text-stone-500">
                        {r.roomName || st?.label || r.roomType || '\u00A0'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      {legend.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
          {legend.map(s => (
            <span key={s} className="inline-flex items-center gap-1.5 text-[0.6875rem] text-stone-500">
              <span className={cn('h-2 w-2 rounded-full', ROOM_STATUS[s].dot)} />
              {ROOM_STATUS[s].label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
