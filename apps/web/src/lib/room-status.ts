// Central room-status visual config shared by the room map & room grid so the
// two views never drift apart. `badgeSolid` is the filled badge used on room-map
// cards; `badgeSoft` is the subtle pill used for selected filter chips on both
// pages (kept identical so the filter UI looks the same everywhere).
export interface RoomStatusStyle {
  label: string
  dot: string
  border: string
  glow: string
  color: string
  badgeSolid: string
  badgeSoft: string
}

export const ROOM_STATUS: Record<string, RoomStatusStyle> = {
  clean:          { label: 'ว่าง',            dot: 'bg-emerald-400', border: 'border-emerald-400/70', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.35)]', color: 'text-emerald-400', badgeSolid: 'bg-emerald-500 text-white',   badgeSoft: 'bg-emerald-400/20 border-emerald-300/30 text-emerald-200' },
  dirty:          { label: 'รอทำความสะอาด',   dot: 'bg-amber-400',   border: 'border-amber-400/70',   glow: 'shadow-[0_0_20px_rgba(251,191,36,0.30)]', color: 'text-amber-400',   badgeSolid: 'bg-amber-500 text-white',     badgeSoft: 'bg-amber-400/20 border-amber-300/30 text-amber-200' },
  occupied:       { label: 'มีผู้เข้าพัก',     dot: 'bg-rose-400',    border: 'border-rose-400/70',    glow: 'shadow-[0_0_20px_rgba(248,113,113,0.35)]', color: 'text-rose-400',  badgeSolid: 'bg-rose-500 text-white',      badgeSoft: 'bg-rose-400/20 border-rose-300/30 text-rose-200' },
  reserved:       { label: 'จองแล้ว',          dot: 'bg-sky-400',     border: 'border-sky-400/70',     glow: 'shadow-[0_0_20px_rgba(56,189,248,0.30)]', color: 'text-sky-400',    badgeSolid: 'bg-sky-500 text-white',       badgeSoft: 'bg-sky-400/20 border-sky-300/30 text-sky-200' },
  cleaning:       { label: 'กำลังทำความสะอาด',  dot: 'bg-sky-300',     border: 'border-sky-300/50',     glow: '',                                         color: 'text-sky-300',    badgeSolid: 'bg-sky-400/90 text-white',    badgeSoft: 'bg-sky-400/20 border-sky-300/30 text-sky-200' },
  out_of_order:   { label: 'ห้องเสีย',          dot: 'bg-stone-500',   border: 'border-stone-600/50',   glow: '',                                         color: 'text-stone-500',  badgeSolid: 'bg-stone-700 text-stone-400', badgeSoft: 'bg-stone-500/20 border-stone-400/30 text-stone-300' },
  out_of_service: { label: 'ปิดบริการ',         dot: 'bg-stone-400',   border: 'border-stone-500/40',   glow: '',                                         color: 'text-stone-400',  badgeSolid: 'bg-stone-600 text-stone-500', badgeSoft: 'bg-stone-400/20 border-stone-300/30 text-stone-300' },
  inspected:      { label: 'ตรวจแล้ว',          dot: 'bg-teal-400',    border: 'border-teal-400/60',    glow: '',                                         color: 'text-teal-400',   badgeSolid: 'bg-teal-500 text-white',      badgeSoft: 'bg-teal-400/20 border-teal-300/30 text-teal-200' },
}

export const OOO_STATUSES = ['out_of_order', 'out_of_service']

// Filter chips per context. The map is date-based (so it includes "reserved");
// the grid filters the room's live housekeeping status (no "reserved"). Labels
// are intentionally identical across both pages — "clean" reads as "ว่าง"
// everywhere so front-desk staff never see two words for the same state.
export const MAP_STATUS_KEYS = ['clean', 'dirty', 'occupied', 'reserved', 'cleaning', 'out_of_order', 'out_of_service', 'inspected']
export const GRID_STATUS_KEYS = ['clean', 'dirty', 'occupied', 'cleaning', 'out_of_order', 'out_of_service', 'inspected']

export interface StatusChip { key: string; label: string; badgeSoft: string; dot: string }

export function buildStatusChips(keys: string[]): StatusChip[] {
  return keys.map(key => {
    const s = ROOM_STATUS[key]
    return { key, label: s.label, badgeSoft: s.badgeSoft, dot: s.dot }
  })
}
