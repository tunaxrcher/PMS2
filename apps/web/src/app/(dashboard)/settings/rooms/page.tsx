'use client'

import React, { useState, useMemo } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, MapPin, Layers, BedDouble, Edit2, Trash2,
  ChevronRight, ChevronLeft, GripVertical, Image as ImageIcon, X as XIcon, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageUpload } from '@/components/ui/image-upload'
import { roomsApi, roomTypesApi, zonesApi, uploadApi } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { ROOM_STATUS } from '@/lib/room-status'

// ── Types ──────────────────────────────────────────────────────
interface Zone { id: string; name: string; zoneType: string; sortOrder: number; imageUrl?: string | null; parentZoneId?: string | null }
interface RoomType { id: string; name: string; description?: string | null; imageUrl?: string | null; baseOccupancy: number; maxOccupancy: number; baseRate: number | string }
interface Room { id: string; roomNumber: string; roomName?: string | null; currentStatus: string; maxOccupancy: number; floorNo?: string | null; roomTypeId: string; zoneId?: string | null; roomType: { id: string; name: string }; zone?: { id: string; name: string } | null }

const ZONE_TYPES = [
  { value: 'building', label: 'อาคาร' },
  { value: 'floor', label: 'ชั้น' },
  { value: 'wing', label: 'ปีก' },
  { value: 'villa_zone', label: 'โซนวิลล่า' },
  { value: 'beach_zone', label: 'โซนชายหาด' },
  { value: 'pool_zone', label: 'โซนสระน้ำ' },
  { value: 'garden_zone', label: 'โซนสวน' },
  { value: 'other', label: 'อื่นๆ' },
]

// ── Hover-action row ───────────────────────────────────────────
function ActionRow({ isSelected, onClick, onEdit, onDelete, children }: {
  isSelected?: boolean; onClick?: () => void
  onEdit: (e: React.MouseEvent) => void; onDelete: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-all',
        isSelected ? 'bg-amber-400/15 border border-amber-300/25' : 'hover:bg-white/[0.05] border border-transparent'
      )}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {/* Action buttons: hidden on hover:hover devices until hover, always visible on touch */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={onEdit}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-stone-500 hover:bg-white/[0.10] hover:text-stone-200 transition-colors"
        >
          <Edit2 className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-stone-500 hover:bg-rose-400/15 hover:text-rose-300 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {/* Arrow indicator for selected state */}
      {isSelected && onClick && (
        <ChevronRight className="h-3 w-3 text-amber-400 flex-shrink-0 -mr-1" />
      )}
    </div>
  )
}

// ── Room tile tooltip ──────────────────────────────────────────
function RoomTileTooltip({ room, children }: { room: Room; children: React.ReactNode }) {
  const s = ROOM_STATUS[room.currentStatus]
  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="center"
            sideOffset={8}
            className="z-50 w-52 rounded-2xl border border-white/[0.12] bg-[#1c1612]/95 p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
          >
            {/* Header: room number + name */}
            <div className="mb-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-black font-mono text-stone-100 leading-none">{room.roomNumber}</span>
                {s && (
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', s.badgeSolid)}>
                    {s.label}
                  </span>
                )}
              </div>
              {room.roomName && (
                <div className="text-xs text-stone-400 mt-1 truncate">{room.roomName}</div>
              )}
            </div>
            {/* Details */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">ประเภท</span>
                <span className="text-stone-300 font-medium truncate max-w-[120px]">{room.roomType.name}</span>
              </div>
              {room.zone && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">โซน</span>
                  <span className="text-stone-300 font-medium truncate max-w-[120px]">{room.zone.name}</span>
                </div>
              )}
              {room.floorNo && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">ชั้น</span>
                  <span className="text-stone-300 font-medium">{room.floorNo}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-stone-500">ความจุสูงสุด</span>
                <span className="text-stone-300 font-medium">{room.maxOccupancy} คน</span>
              </div>
            </div>
            <Tooltip.Arrow className="fill-[#1c1612]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

// ── Column wrapper ─────────────────────────────────────────────
function Column({ title, icon: Icon, count, onAdd, addLabel, onAddBulk, children, loading, className = '' }: {
  title: string; icon: React.ElementType; count?: number; onAdd: () => void; addLabel: string
  onAddBulk?: () => void
  children: React.ReactNode; loading?: boolean; className?: string
}) {
  return (
    <div className={cn('flex flex-col rounded-2xl border border-white/[0.10] bg-black/20 backdrop-blur-sm overflow-hidden', className)}>
      {/* Column header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/15">
            <Icon className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-stone-200">{title}</span>
          {count !== undefined && (
            <span className="ml-0.5 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-stone-400">{count}</span>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="space-y-1.5 p-1">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : children}
      </div>

      {/* Add button(s) — pinned at bottom */}
      <div className="border-t border-white/[0.06] p-2">
        {onAddBulk ? (
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={onAdd}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-2.5 text-xs text-stone-500 hover:border-amber-300/30 hover:text-amber-300 transition-colors">
              <Plus className="h-3.5 w-3.5" /> ห้องเดียว
            </button>
            <button onClick={onAddBulk}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-sky-400/20 py-2.5 text-xs text-stone-500 hover:border-sky-400/40 hover:text-sky-400 transition-colors">
              <span>⚡</span> สร้างเป็นชุด
            </button>
          </div>
        ) : (
          <button onClick={onAdd}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-2 text-xs text-stone-500 hover:border-amber-300/30 hover:text-amber-300 transition-colors">
            <Plus className="h-3.5 w-3.5" /> {addLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Sortable zone card ─────────────────────────────────────────
function SortableZoneRow({ zone, isSelected, isDimmed, onClick, onEdit, onDelete, count }: {
  zone: Zone; isSelected: boolean; isDimmed?: boolean; onClick: () => void
  onEdit: (e: React.MouseEvent) => void; onDelete: (e: React.MouseEvent) => void; count: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: zone.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : isDimmed ? 0.35 : 1 }}
      className={cn(
        'group relative rounded-2xl overflow-hidden transition-all duration-150',
        isDimmed ? 'cursor-default' : 'cursor-pointer',
        isSelected
          ? 'ring-2 ring-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
          : !isDimmed && 'hover:scale-[1.02] hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
      )}
      onClick={isDimmed ? undefined : onClick}
    >
      {/* Background image or gradient */}
      {zone.imageUrl ? (
        <img src={zone.imageUrl} alt={zone.name} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/40 via-stone-900/60 to-stone-950" />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

      {/* Content */}
          <div className="relative px-3 pt-10 pb-3 min-h-[96px] flex flex-col justify-end">
            <div className="flex items-end justify-between gap-1">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate leading-tight">{zone.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] text-white/50">{ZONE_TYPES.find(t => t.value === zone.zoneType)?.label}</span>
                  <span className="text-[9px] text-white/30">·</span>
                  <span className="text-[9px] text-white/60">{count} ห้อง{isDimmed ? ' · ไม่มีในประเภทนี้' : ''}</span>
                </div>
              </div>
              {isSelected && <ChevronRight className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />}
            </div>
          </div>

      {/* Drag handle — top left */}
      <button
        {...attributes} {...listeners}
        onClick={e => e.stopPropagation()}
        className="absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-lg bg-black/30 text-white/40 hover:text-white/80 cursor-grab active:cursor-grabbing touch-none transition-colors"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Edit/Delete — top right, on hover */}
      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
        <button onClick={onEdit} className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/40 text-white/60 hover:text-white transition-colors"><Edit2 className="h-3 w-3" /></button>
        <button onClick={onDelete} className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/40 text-rose-300/80 hover:text-rose-300 transition-colors"><Trash2 className="h-3 w-3" /></button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export default function RoomsSettingsPage() {
  const qc = useQueryClient()

  // ── Selection state (Miller column) ──
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null)
  // Mobile: which column is visible (0=zones, 1=types, 2=rooms)
  const [mobileCol, setMobileCol] = useState(0)

  // ── Dialog state ──
  type DialogMode = 'zone' | 'roomType' | 'room' | 'bulk' | null
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [editTarget, setEditTarget] = useState<Zone | RoomType | Room | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'zone' | 'roomType' | 'room' } | null>(null)

  // ── Forms ──
  const [zoneForm, setZoneForm] = useState({ name: '', zoneType: 'other', parentZoneId: '', imageUrl: '' })
  const [rtForm, setRtForm] = useState({ name: '', description: '', imageUrl: '', baseOccupancy: '2', maxOccupancy: '4', baseRate: '0' })
  const [roomForm, setRoomForm] = useState({ roomTypeId: '', zoneId: '', roomNumber: '', roomName: '', floorNo: '', maxOccupancy: '4' })
  const [roomStep, setRoomStep] = useState(1)
  const [imgUploading, setImgUploading] = useState(false)

  // ── Bulk create state ──
  interface BulkRow { roomNumber: string; roomName: string; floorNo: string }
  const [bulkForm, setBulkForm] = useState({ roomTypeId: '', zoneId: '', floorNo: '1', from: '', to: '', namePattern: '' })
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([])
  const [bulkStep, setBulkStep] = useState(1)
  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(0)

  // ── Queries ──
  const { data: zonesData = [], isLoading: zonesLoading } = useQuery<Zone[]>({ queryKey: ['zones-flat'], queryFn: () => zonesApi.flat().then(r => r.data) })
  const [zoneOrder, setZoneOrder] = useState<string[]>([])
  // Sorted zones — local order takes priority once user drags
  const zones = useMemo(() => {
    if (zoneOrder.length === 0) return zonesData
    return [...zonesData].sort((a, b) => zoneOrder.indexOf(a.id) - zoneOrder.indexOf(b.id))
  }, [zonesData, zoneOrder])
  const { data: roomTypes = [], isLoading: typesLoading } = useQuery<RoomType[]>({ queryKey: ['room-types'], queryFn: () => roomTypesApi.list().then(r => r.data) })
  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({ queryKey: ['rooms'], queryFn: () => roomsApi.list().then(r => r.data) })

  // ── Room images — fetched only when editing ──
  const editingRoomId = (editTarget as Room | null)?.id ?? null
  const { data: roomImages = [] } = useQuery<{ id: string; url: string; isPrimary: boolean; caption?: string | null }[]>({
    queryKey: ['room-images', editingRoomId],
    queryFn: () => roomsApi.getImages(editingRoomId!).then(r => r.data),
    enabled: !!editingRoomId && dialogMode === 'room',
  })
  const addImageMutation = useMutation({
    mutationFn: ({ roomId, url, isPrimary }: { roomId: string; url: string; isPrimary: boolean }) =>
      roomsApi.addImage(roomId, { url, isPrimary }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['room-images', editingRoomId] }),
    onError: () => toast.error('เพิ่มรูปไม่สำเร็จ'),
  })
  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) => roomsApi.deleteImage(imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['room-images', editingRoomId] }),
    onError: () => toast.error('ลบรูปไม่สำเร็จ'),
  })

  const handleRoomImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingRoomId) return
    const file = e.target.files?.[0]; if (!file) return
    setImgUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await uploadApi.uploadImage(fd)
      await addImageMutation.mutateAsync({ roomId: editingRoomId, url: res.data.url, isPrimary: roomImages.length === 0 })
      toast.success('เพิ่มรูปสำเร็จ')
    } catch { toast.error('อัปโหลดไม่สำเร็จ') }
    finally { setImgUploading(false); e.target.value = '' }
  }

  // ── Filtered data ──
  const filteredRooms = useMemo(() => rooms.filter(r => {
    if (selectedZoneId && r.zoneId !== selectedZoneId) return false
    if (selectedRoomTypeId && r.roomTypeId !== selectedRoomTypeId) return false
    return true
  }), [rooms, selectedZoneId, selectedRoomTypeId])

  const roomCountByZone = useMemo(() => {
    const map: Record<string, number> = {}
    rooms.forEach(r => { if (r.zoneId) map[r.zoneId] = (map[r.zoneId] || 0) + 1 })
    return map
  }, [rooms])

  // Zones that have at least one room of the selected type — used to dim zones
  const zonesWithSelectedType = useMemo(() => {
    if (!selectedRoomTypeId) return null
    const ids = new Set<string>()
    rooms.forEach(r => { if (r.roomTypeId === selectedRoomTypeId && r.zoneId) ids.add(r.zoneId) })
    return ids
  }, [rooms, selectedRoomTypeId])

  const roomCountByType = useMemo(() => {
    const map: Record<string, number> = {}
    const source = selectedZoneId ? rooms.filter(r => r.zoneId === selectedZoneId) : rooms
    source.forEach(r => { map[r.roomTypeId] = (map[r.roomTypeId] || 0) + 1 })
    return map
  }, [rooms, selectedZoneId])

  // ── Mutations ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleZoneDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const currentIds = zones.map(z => z.id)
      const oldIndex = currentIds.indexOf(active.id as string)
      const newIndex = currentIds.indexOf(over.id as string)
      const newOrder = arrayMove(currentIds, oldIndex, newIndex)
      setZoneOrder(newOrder)
      // Persist new order to backend
      newOrder.forEach((id, idx) => {
        zonesApi.update(id, { sortOrder: idx }).catch(() => {/* silent */})
      })
    }
  }

  const zoneMutations = {
    create: useMutation({ mutationFn: (d: Record<string, unknown>) => zonesApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-flat'] }); closeDialog(); toast.success('เพิ่มโซนสำเร็จ') }, onError: () => toast.error('เกิดข้อผิดพลาด') }),
    update: useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => zonesApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-flat'] }); closeDialog(); toast.success('แก้ไขสำเร็จ') }, onError: () => toast.error('เกิดข้อผิดพลาด') }),
    delete: useMutation({ mutationFn: (id: string) => zonesApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-flat'] }); qc.invalidateQueries({ queryKey: ['rooms'] }); setZoneOrder([]); toast.success('ลบสำเร็จ') }, onError: () => toast.error('ไม่สามารถลบโซนที่มีห้องพักอยู่ได้') }),
  }
  const typeMutations = {
    create: useMutation({ mutationFn: (d: Record<string, unknown>) => roomTypesApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-types'] }); closeDialog(); toast.success('เพิ่มประเภทห้องสำเร็จ') }, onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด') }),
    update: useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => roomTypesApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-types'] }); closeDialog(); toast.success('แก้ไขสำเร็จ') }, onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด') }),
    delete: useMutation({ mutationFn: (id: string) => roomTypesApi.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-types'] }); qc.invalidateQueries({ queryKey: ['rooms'] }); toast.success('ลบสำเร็จ') }, onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'ไม่สามารถลบได้') }),
  }
  const roomMutations = {
    create: useMutation({ mutationFn: (d: Record<string, unknown>) => roomsApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); closeDialog(); toast.success('เพิ่มห้องพักสำเร็จ') }, onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด') }),
    update: useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => roomsApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); closeDialog(); toast.success('แก้ไขสำเร็จ') }, onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด') }),
    delete: useMutation({ mutationFn: (id: string) => roomsApi.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); toast.success('ปิดใช้งานห้องสำเร็จ') }, onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message || 'เกิดข้อผิดพลาด') }),
  }

  // ── Dialog helpers ──
  const closeDialog = () => { setDialogMode(null); setEditTarget(null) }

  const openZoneCreate = () => { setEditTarget(null); setZoneForm({ name: '', zoneType: 'other', parentZoneId: '', imageUrl: '' }); setDialogMode('zone') }
  const openZoneEdit = (z: Zone, e: React.MouseEvent) => { e.stopPropagation(); setEditTarget(z); setZoneForm({ name: z.name, zoneType: z.zoneType, parentZoneId: z.parentZoneId || '', imageUrl: z.imageUrl || '' }); setDialogMode('zone') }

  const openTypeCreate = () => { setEditTarget(null); setRtForm({ name: '', description: '', imageUrl: '', baseOccupancy: '2', maxOccupancy: '4', baseRate: '0' }); setDialogMode('roomType') }
  const openTypeEdit = (rt: RoomType, e: React.MouseEvent) => { e.stopPropagation(); setEditTarget(rt); setRtForm({ name: rt.name, description: rt.description || '', imageUrl: rt.imageUrl || '', baseOccupancy: String(rt.baseOccupancy), maxOccupancy: String(rt.maxOccupancy), baseRate: String(rt.baseRate) }); setDialogMode('roomType') }

  const openRoomCreate = () => {
    setEditTarget(null)
    setRoomForm({ roomTypeId: selectedRoomTypeId || '', zoneId: selectedZoneId || '', roomNumber: '', roomName: '', floorNo: '', maxOccupancy: '4' })
    setRoomStep(1)
    setDialogMode('room')
  }
  const openRoomEdit = (r: Room, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditTarget(r)
    setRoomForm({ roomTypeId: r.roomTypeId, zoneId: r.zoneId || '', roomNumber: r.roomNumber, roomName: r.roomName || '', floorNo: r.floorNo || '', maxOccupancy: String(r.maxOccupancy) })
    setRoomStep(1)
    setDialogMode('room')
  }

  // ── Submit handlers ──
  const submitZone = () => {
    if (!zoneForm.name) { toast.error('กรุณาระบุชื่อโซน'); return }
    const payload = { name: zoneForm.name, zoneType: zoneForm.zoneType, parentZoneId: zoneForm.parentZoneId || undefined, imageUrl: zoneForm.imageUrl || undefined }
    const target = editTarget as Zone | null
    if (target) zoneMutations.update.mutate({ id: target.id, d: payload })
    else zoneMutations.create.mutate(payload)
  }
  const submitType = () => {
    if (!rtForm.name) { toast.error('กรุณาระบุชื่อประเภทห้อง'); return }
    const payload = { name: rtForm.name, description: rtForm.description || undefined, imageUrl: rtForm.imageUrl || undefined, baseOccupancy: Number(rtForm.baseOccupancy), maxOccupancy: Number(rtForm.maxOccupancy), baseRate: Number(rtForm.baseRate) }
    const target = editTarget as RoomType | null
    if (target) typeMutations.update.mutate({ id: target.id, d: payload })
    else typeMutations.create.mutate(payload)
  }
  const submitRoom = () => {
    if (!roomForm.roomNumber || !roomForm.roomTypeId) { toast.error('กรุณากรอกข้อมูลให้ครบ'); return }
    const payload = { roomTypeId: roomForm.roomTypeId, zoneId: roomForm.zoneId || undefined, roomNumber: roomForm.roomNumber, roomName: roomForm.roomName || undefined, floorNo: roomForm.floorNo || undefined, maxOccupancy: Number(roomForm.maxOccupancy) }
    const target = editTarget as Room | null
    if (target) roomMutations.update.mutate({ id: target.id, d: payload })
    else roomMutations.create.mutate(payload)
  }

  // ── Bulk create helpers ──
  const generateBulkPreview = () => {
    const from = parseInt(bulkForm.from)
    const to = parseInt(bulkForm.to)
    if (isNaN(from) || isNaN(to) || from > to) { toast.error('กรุณาระบุช่วงหมายเลขห้องที่ถูกต้อง'); return }
    if (to - from + 1 > 100) { toast.error('สร้างได้สูงสุด 100 ห้องต่อครั้ง'); return }
    const rows: BulkRow[] = []
    for (let n = from; n <= to; n++) {
      const num = String(n)
      const name = bulkForm.namePattern
        ? bulkForm.namePattern.replace('{num}', num).replace('{n}', num)
        : ''
      rows.push({ roomNumber: num, roomName: name, floorNo: bulkForm.floorNo })
    }
    setBulkRows(rows)
    setBulkStep(2)
  }

  const submitBulk = async () => {
    if (!bulkForm.roomTypeId) { toast.error('กรุณาเลือกประเภทห้อง'); return }
    if (bulkRows.length === 0) return
    // Inherit maxOccupancy from the selected room type (not hardcoded 4)
    const selectedRt = roomTypes.find(rt => rt.id === bulkForm.roomTypeId)
    const maxOccupancy = Number(selectedRt?.maxOccupancy ?? 4)
    setBulkCreating(true)
    setBulkProgress(0)
    let success = 0
    for (let i = 0; i < bulkRows.length; i++) {
      const row = bulkRows[i]
      if (!row.roomNumber.trim()) continue
      try {
        await roomsApi.create({
          roomTypeId: bulkForm.roomTypeId,
          zoneId: bulkForm.zoneId || undefined,
          roomNumber: row.roomNumber.trim(),
          roomName: row.roomName.trim() || undefined,
          floorNo: row.floorNo.trim() || undefined,
          maxOccupancy,
        })
        success++
      } catch { /* skip duplicates */ }
      setBulkProgress(Math.round(((i + 1) / bulkRows.length) * 100))
    }
    setBulkCreating(false)
    qc.invalidateQueries({ queryKey: ['rooms'] })
    closeDialog()
    toast.success(`สร้างห้องพักสำเร็จ ${success} ห้อง`)
  }

  const openBulkCreate = () => {
    setBulkForm({ roomTypeId: selectedRoomTypeId || '', zoneId: selectedZoneId || '', floorNo: '1', from: '', to: '', namePattern: '' })
    setBulkRows([])
    setBulkStep(1)
    setDialogMode('bulk')
  }

  // ── Delete confirm ──
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'zone') zoneMutations.delete.mutate(deleteTarget.id)
    else if (deleteTarget.type === 'roomType') typeMutations.delete.mutate(deleteTarget.id)
    else roomMutations.delete.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  const colHeight = 'h-[calc(100vh-180px)] max-h-[780px]'


  return (
    <AppShell title="จัดการห้องพัก" subtitle="โซน · ประเภทห้อง · ห้องพัก">

      {/* Mobile tab bar */}
      <div className="flex lg:hidden rounded-2xl border border-white/[0.10] bg-black/20 p-1 mb-3 gap-1">
        {[
          { col: 0, icon: MapPin, label: 'โซน' },
          { col: 1, icon: Layers, label: 'ประเภท' },
          { col: 2, icon: BedDouble, label: 'ห้องพัก' },
        ].map(({ col, icon: Icon, label }) => (
          <button key={col} onClick={() => setMobileCol(col)}
            className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-all',
              mobileCol === col ? 'bg-amber-400/15 text-amber-200 border border-amber-300/20' : 'text-stone-500 hover:text-stone-300')}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Desktop: 3 columns | Mobile: 1 column at a time */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_3fr_6fr] gap-3.5">

        {/* ── Column 1: Zones ── */}
        <Column
          title="โซน"
          icon={MapPin}
          count={zones.length}
          onAdd={openZoneCreate}
          addLabel="เพิ่มโซน"
          loading={zonesLoading}
          className={cn(colHeight, mobileCol !== 0 && 'hidden lg:flex')}
        >
          {/* "ทั้งหมด" row */}
          <div
            onClick={() => { setSelectedZoneId(null); setSelectedRoomTypeId(null) }}
            className={cn(
              'flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition-all border',
              !selectedZoneId
                ? 'bg-amber-400/15 border-amber-300/25 text-amber-200'
                : 'border-transparent text-stone-400 hover:bg-white/[0.05] hover:text-stone-200'
            )}
          >
            <span className="text-xs font-medium">ทั้งหมด</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-stone-600">{rooms.length} ห้อง</span>
              {!selectedZoneId && <ChevronRight className="h-3 w-3 text-amber-400" />}
            </div>
          </div>

          {zones.length === 0 && !zonesLoading && (
            <div className="flex flex-col items-center gap-2 py-8 text-stone-600">
              <MapPin className="h-8 w-8 opacity-40" />
              <p className="text-xs">ยังไม่มีโซน</p>
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleZoneDragEnd}>
            <SortableContext items={zones.map(z => z.id)} strategy={verticalListSortingStrategy}>
              {zones.map(z => (
                <SortableZoneRow
                  key={z.id}
                  zone={z}
                  isSelected={selectedZoneId === z.id}
                  isDimmed={zonesWithSelectedType !== null && !zonesWithSelectedType.has(z.id)}
                  count={roomCountByZone[z.id] || 0}
                  onClick={() => { setSelectedZoneId(z.id); setSelectedRoomTypeId(null); if (window.innerWidth < 1024) setMobileCol(1) }}
                  onEdit={e => openZoneEdit(z, e)}
                  onDelete={e => { e.stopPropagation(); setDeleteTarget({ id: z.id, name: z.name, type: 'zone' }) }}
                />
              ))}
            </SortableContext>
          </DndContext>
        </Column>

        {/* ── Column 2: Room Types ── */}
        <Column
          title="ประเภทห้อง"
          icon={Layers}
          count={roomTypes.length}
          onAdd={openTypeCreate}
          addLabel="เพิ่มประเภทห้อง"
          loading={typesLoading}
          className={cn(colHeight, mobileCol !== 1 && 'hidden lg:flex')}
        >
          {/* "ทั้งหมด" row */}
          <div
            onClick={() => setSelectedRoomTypeId(null)}
            className={cn(
              'flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition-all border',
              !selectedRoomTypeId
                ? 'bg-amber-400/15 border-amber-300/25 text-amber-200'
                : 'border-transparent text-stone-400 hover:bg-white/[0.05] hover:text-stone-200'
            )}
          >
            <span className="text-xs font-medium">ทั้งหมด</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-stone-600">
                {selectedZoneId ? (roomCountByZone[selectedZoneId] || 0) : rooms.length} ห้อง
              </span>
              {!selectedRoomTypeId && <ChevronRight className="h-3 w-3 text-amber-400" />}
            </div>
          </div>

          {roomTypes.length === 0 && !typesLoading && (
            <div className="flex flex-col items-center gap-2 py-8 text-stone-600">
              <Layers className="h-8 w-8 opacity-40" />
              <p className="text-xs">ยังไม่มีประเภทห้อง</p>
            </div>
          )}

          {roomTypes.map(rt => {
            const count = roomCountByType[rt.id] || 0
            // When a zone is selected, show types with 0 rooms dimmed (not absent) so
            // users don't think the type disappeared — they just can't add that combo.
            const notInZone = !!selectedZoneId && count === 0
            return (
              <div
                key={rt.id}
                onClick={() => { if (!notInZone) { setSelectedRoomTypeId(rt.id); if (window.innerWidth < 1024) setMobileCol(2) } }}
                className={cn(
                  'group relative rounded-2xl overflow-hidden transition-all duration-150',
                  notInZone ? 'opacity-40 cursor-default' : 'cursor-pointer',
                  selectedRoomTypeId === rt.id
                    ? 'ring-2 ring-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                    : !notInZone && 'hover:scale-[1.02] hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
                )}
              >
                {/* Background image or gradient */}
                {rt.imageUrl ? (
                  <img src={rt.imageUrl} alt={rt.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-stone-800/80 via-stone-900/60 to-stone-950" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

                {/* Content */}
                <div className="relative px-3 pt-10 pb-3 min-h-[96px] flex flex-col justify-end">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate leading-tight">{rt.name}</div>
                      <div className="text-[9px] text-white/50 mt-0.5">{count} ห้อง{notInZone ? ' · ไม่มีในโซนนี้' : ''}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-base font-black text-amber-300 leading-none">{formatCurrency(Number(rt.baseRate))}</div>
                        <div className="text-[9px] text-white/30 mt-0.5">ต่อคืน</div>
                      </div>
                      {selectedRoomTypeId === rt.id && <ChevronRight className="h-3.5 w-3.5 text-amber-400 ml-1" />}
                    </div>
                  </div>
                </div>

                {/* Edit/Delete — top right hover */}
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); openTypeEdit(rt, e) }} className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/40 text-white/60 hover:text-white transition-colors"><Edit2 className="h-3 w-3" /></button>
                  <button onClick={e => { e.stopPropagation(); setDeleteTarget({ id: rt.id, name: rt.name, type: 'roomType' }) }} className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/40 text-rose-300/80 hover:text-rose-300 transition-colors"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            )
          })}
        </Column>

        {/* ── Column 3: Rooms ── */}
        <Column
          title="ห้องพัก"
          icon={BedDouble}
          count={filteredRooms.length}
          onAdd={openRoomCreate}
          addLabel="เพิ่มห้อง"
          onAddBulk={openBulkCreate}
          loading={roomsLoading}
          className={cn(colHeight, mobileCol !== 2 && 'hidden lg:flex')}
        >
          {filteredRooms.length === 0 && !roomsLoading && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                <BedDouble className="h-7 w-7 text-stone-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-400">ยังไม่มีห้องพัก</p>
                <p className="text-xs text-stone-600 mt-0.5">เลือกโซนและประเภทแล้วเพิ่มห้องพัก</p>
              </div>
              <button onClick={openRoomCreate}
                className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-400/15 transition-colors">
                + เพิ่มห้องพัก
              </button>
            </div>
          )}

          {/* Zone context banner — shown when a zone with an image is selected */}
          {selectedZoneId && (() => {
            const z = zones.find(z => z.id === selectedZoneId)
            if (!z?.imageUrl) return null
            return (
              <div className="relative rounded-xl overflow-hidden mb-3 h-20">
                <img src={z.imageUrl} alt={z.name} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-3 py-2">
                  <p className="text-sm font-bold text-white leading-tight">{z.name}</p>
                  <p className="text-xs text-white/50">{filteredRooms.length} ห้อง</p>
                </div>
              </div>
            )
          })()}

          {/* Floor cross-section — group by floor */}
          {filteredRooms.length > 0 && (() => {
            const floorMap = new Map<string, Room[]>()
            filteredRooms.forEach(r => {
              const floor = r.floorNo || 'ไม่ระบุชั้น'
              if (!floorMap.has(floor)) floorMap.set(floor, [])
              floorMap.get(floor)!.push(r)
            })
            const sortedFloors = Array.from(floorMap.keys()).sort((a, b) => {
              const na = Number(a), nb = Number(b)
              if (!isNaN(na) && !isNaN(nb)) return na - nb
              return a.localeCompare(b, 'th')
            })
            return sortedFloors.map(floor => (
              <div key={floor} className="mb-4">
                {/* Floor label — pill style */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] px-2.5 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      {floor === 'ไม่ระบุชั้น' ? floor : `ชั้น ${floor}`}
                    </span>
                    <span className="text-[10px] text-stone-600">· {floorMap.get(floor)!.length}</span>
                  </div>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                </div>

                {/* Room tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                  {floorMap.get(floor)!.map(room => {
                    const s = ROOM_STATUS[room.currentStatus]
                    // Subtle tinted backgrounds per status
                    const tileBg: Record<string, string> = {
                      clean:          'bg-emerald-400/[0.06] border-emerald-400/[0.15] hover:bg-emerald-400/[0.11]',
                      occupied:       'bg-rose-400/[0.06]    border-rose-400/[0.15]    hover:bg-rose-400/[0.11]',
                      dirty:          'bg-amber-400/[0.06]   border-amber-400/[0.15]   hover:bg-amber-400/[0.11]',
                      cleaning:       'bg-sky-400/[0.06]     border-sky-400/[0.15]     hover:bg-sky-400/[0.11]',
                      out_of_order:   'bg-stone-500/[0.06]   border-stone-500/[0.15]   hover:bg-stone-500/[0.10]',
                      out_of_service: 'bg-stone-500/[0.04]   border-stone-500/[0.12]   hover:bg-stone-500/[0.08]',
                      inspected:      'bg-teal-400/[0.06]    border-teal-400/[0.15]    hover:bg-teal-400/[0.11]',
                    }
                    return (
                      <div key={room.id} className="group relative">
                        <RoomTileTooltip room={room}>
                        <div className={cn(
                          'relative rounded-2xl border cursor-pointer transition-all duration-150 hover:shadow-[0_4px_20px_rgba(0,0,0,0.45)] hover:scale-[1.03]',
                          tileBg[room.currentStatus] || 'bg-white/[0.04] border-white/[0.10] hover:bg-white/[0.07]',
                        )}>
                          {/* Status dot — top right */}
                          <span className={cn('absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full shadow-sm', s?.dot || 'bg-stone-600')} />

                          {/* Body */}
                          <div className="px-3 pt-5 pb-4 flex flex-col justify-between min-h-[130px]">
                            <div>
                              {/* Room number */}
                              <div className="text-3xl font-black font-mono text-stone-100 leading-none tracking-tight">{room.roomNumber}</div>
                              {/* Room name — only if set */}
                              {room.roomName && (
                                <div className="text-[10px] text-stone-300 mt-1 truncate leading-tight font-medium">{room.roomName}</div>
                              )}
                              {/* Room type */}
                              <div className="text-[9px] text-stone-500 mt-1 truncate leading-tight">{room.roomType.name}</div>
                              {room.zone && !selectedZoneId && (
                                <div className="text-[9px] text-stone-700 truncate leading-tight mt-0.5">{room.zone.name}</div>
                              )}
                            </div>
                          </div>

                          {/* Hover overlay */}
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/75 backdrop-blur-sm opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 rounded-2xl transition-opacity">
                            <button
                              onClick={e => openRoomEdit(room, e)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-stone-200 hover:bg-amber-400/30 hover:text-amber-300 transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteTarget({ id: room.id, name: `ห้อง ${room.roomNumber}`, type: 'room' }) }}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/35 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        </RoomTileTooltip>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          })()}
        </Column>
      </div>

      {/* ── Zone Dialog ── */}
      <PmsDialog
        open={dialogMode === 'zone'}
        onClose={closeDialog}
        title={(editTarget as Zone | null)?.id ? 'แก้ไขโซน' : 'เพิ่มโซน'}
        description="กำหนดพื้นที่หรือโซนของที่พัก เช่น ชั้น 1, Beach Zone"
        size="md"
      >
        <div className="space-y-4">
          <Input label="ชื่อโซน *" value={zoneForm.name} onChange={e => setZoneForm(p => ({...p, name: e.target.value}))} placeholder="Garden Zone / ชั้น 1" autoFocus />
          <ImageUpload label="รูปภาพโซน" value={zoneForm.imageUrl} onChange={url => setZoneForm(p => ({...p, imageUrl: url}))} onRemove={() => setZoneForm(p => ({...p, imageUrl: ''}))} placeholder="รูปแทนโซนนี้" />
          <Select value={zoneForm.zoneType} onValueChange={v => setZoneForm(p => ({...p, zoneType: v}))}>
            <SelectTrigger label="ประเภทโซน"><SelectValue /></SelectTrigger>
            <SelectContent>{ZONE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={zoneForm.parentZoneId || 'none'} onValueChange={v => setZoneForm(p => ({...p, parentZoneId: v === 'none' ? '' : v}))}>
            <SelectTrigger label="โซนแม่ (ถ้ามี)"><SelectValue placeholder="ไม่มี" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ไม่มี</SelectItem>
              {zones.filter(z => z.id !== (editTarget as Zone | null)?.id).map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={submitZone} loading={zoneMutations.create.isPending || zoneMutations.update.isPending} className="w-full">
            {(editTarget as Zone | null)?.id ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มโซน'}
          </Button>
        </div>
      </PmsDialog>

      {/* ── Room Type Dialog ── */}
      <PmsDialog
        open={dialogMode === 'roomType'}
        onClose={closeDialog}
        title={(editTarget as RoomType | null)?.id ? 'แก้ไขประเภทห้อง' : 'เพิ่มประเภทห้อง'}
        description="กำหนดประเภทห้อง เช่น Deluxe Room, Pool Villa พร้อมราคาและรูปภาพ"
        size="lg"
      >
        <div className="space-y-4">
          <Input label="ชื่อประเภทห้อง *" value={rtForm.name} onChange={e => setRtForm(p => ({...p, name: e.target.value}))} placeholder="Deluxe Room" autoFocus />
          <Input label="รายละเอียด" value={rtForm.description} onChange={e => setRtForm(p => ({...p, description: e.target.value}))} placeholder="ห้อง Deluxe วิวสระว่ายน้ำ" />
          <ImageUpload label="รูปภาพตัวอย่าง" value={rtForm.imageUrl} onChange={url => setRtForm(p => ({...p, imageUrl: url}))} onRemove={() => setRtForm(p => ({...p, imageUrl: ''}))} placeholder="รูปประเภทห้อง" aspectRatio="wide" />
          <div className="grid grid-cols-3 gap-3">
            <Input label="ความจุปกติ" type="number" value={rtForm.baseOccupancy} onChange={e => setRtForm(p => ({...p, baseOccupancy: e.target.value}))} min="1" />
            <Input label="ความจุสูงสุด" type="number" value={rtForm.maxOccupancy} onChange={e => setRtForm(p => ({...p, maxOccupancy: e.target.value}))} min="1" />
            <Input label="ราคาเริ่มต้น (฿)" type="number" value={rtForm.baseRate} onChange={e => setRtForm(p => ({...p, baseRate: e.target.value}))} min="0" />
          </div>
          <Button onClick={submitType} loading={typeMutations.create.isPending || typeMutations.update.isPending} className="w-full">
            {(editTarget as RoomType | null)?.id ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มประเภทห้อง'}
          </Button>
        </div>
      </PmsDialog>

      {/* ── Room Dialog — 2-step wizard ── */}
      <PmsDialog
        open={dialogMode === 'room'}
        onClose={closeDialog}
        title={(editTarget as Room | null)?.id ? 'แก้ไขห้องพัก' : 'เพิ่มห้องพัก'}
        description={roomStep === 1 ? 'กำหนดหมายเลขและชื่อห้อง' : 'เลือกประเภทห้องและโซน'}
        size="lg"
      >
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-5">
          {[1, 2].map(s => (
            <React.Fragment key={s}>
              <button
                onClick={() => s < roomStep && setRoomStep(s)}
                className={cn(
                  'flex items-center gap-2 text-xs font-medium transition-colors',
                  roomStep === s ? 'text-amber-300' : s < roomStep ? 'text-stone-400 hover:text-stone-300 cursor-pointer' : 'text-stone-700 cursor-default'
                )}
              >
                <span className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border transition-all',
                  roomStep === s ? 'bg-amber-400 border-amber-400 text-stone-900' : s < roomStep ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-transparent border-stone-700 text-stone-600'
                )}>
                  {s < roomStep ? '✓' : s}
                </span>
                {s === 1 ? 'ข้อมูลห้อง' : 'ประเภท & โซน'}
              </button>
              {s < 2 && <div className={cn('flex-1 h-px', roomStep > 1 ? 'bg-emerald-500/40' : 'bg-white/10')} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Room info */}
        {roomStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="หมายเลขห้อง *" value={roomForm.roomNumber} onChange={e => setRoomForm(p => ({...p, roomNumber: e.target.value}))} placeholder="101" autoFocus />
              <Input label="ชื่อห้อง" value={roomForm.roomName} onChange={e => setRoomForm(p => ({...p, roomName: e.target.value}))} placeholder="Garden View 101" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="ชั้น / อาคาร" value={roomForm.floorNo} onChange={e => setRoomForm(p => ({...p, floorNo: e.target.value}))} placeholder="1" />
              <Input label="ความจุสูงสุด" type="number" value={roomForm.maxOccupancy} onChange={e => setRoomForm(p => ({...p, maxOccupancy: e.target.value}))} min="1" max="20" />
            </div>
            <Button
              onClick={() => { if (!roomForm.roomNumber) { toast.error('กรุณากรอกหมายเลขห้อง'); return } setRoomStep(2) }}
              className="w-full"
            >
              ถัดไป → เลือกประเภทห้อง
            </Button>
          </div>
        )}

        {/* Step 2: Room type + Zone visual picker */}
        {roomStep === 2 && (
          <div className="space-y-5">
            {/* Room Type Grid */}
            <div>
              <p className="text-xs font-semibold text-stone-400 mb-2.5">ประเภทห้อง <span className="text-rose-400">*</span></p>
              {roomTypes.length === 0 ? (
                <p className="text-xs text-stone-600 py-3 text-center">ยังไม่มีประเภทห้อง — กรุณาเพิ่มในคอลัมน์ด้านซ้ายก่อน</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-0.5">
                  {roomTypes.map(rt => {
                    const isSelected = roomForm.roomTypeId === rt.id
                    return (
                      <button
                        key={rt.id}
                        onClick={() => setRoomForm(p => ({...p, roomTypeId: rt.id}))}
                        className={cn(
                          'relative flex flex-col items-start rounded-2xl border overflow-hidden text-left transition-all',
                          isSelected ? 'border-amber-400/60 shadow-[0_0_0_2px_rgba(251,191,36,0.25)]' : 'border-white/10 hover:border-white/20'
                        )}
                      >
                        {/* Image or placeholder */}
                        <div className="w-full aspect-video bg-stone-800 relative">
                          {rt.imageUrl
                            ? <img src={rt.imageUrl} alt={rt.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Layers className="h-6 w-6 text-stone-600" /></div>
                          }
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-stone-900 text-[10px] font-black">✓</div>
                          )}
                        </div>
                        <div className="px-2.5 py-2 w-full">
                          <div className="text-xs font-semibold text-stone-200 truncate">{rt.name}</div>
                          <div className="text-[10px] text-stone-500 mt-0.5">{formatCurrency(Number(rt.baseRate))}/คืน · {rt.baseOccupancy}–{rt.maxOccupancy} คน</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Zone Grid */}
            <div>
              <p className="text-xs font-semibold text-stone-400 mb-2.5">โซน <span className="text-stone-600 font-normal">(ไม่บังคับ)</span></p>
              <div className="flex flex-wrap gap-2">
                {/* No zone option */}
                <button
                  onClick={() => setRoomForm(p => ({...p, zoneId: ''}))}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-3 text-xs transition-all',
                    !roomForm.zoneId ? 'border-amber-400/60 bg-amber-400/10 text-amber-200 shadow-[0_0_0_2px_rgba(251,191,36,0.2)]' : 'border-white/10 text-stone-500 hover:border-white/20'
                  )}
                >
                  <span className="text-lg">🚫</span>
                  <span className="font-medium">ไม่ระบุ</span>
                </button>

                {zones.map(z => {
                  const isSelected = roomForm.zoneId === z.id
                  return (
                    <button
                      key={z.id}
                      onClick={() => setRoomForm(p => ({...p, zoneId: z.id}))}
                      className={cn(
                        'relative flex flex-col items-center overflow-hidden rounded-2xl border transition-all',
                        isSelected ? 'border-amber-400/60 shadow-[0_0_0_2px_rgba(251,191,36,0.25)]' : 'border-white/10 hover:border-white/20'
                      )}
                      style={{ width: 88 }}
                    >
                      <div className="w-full h-14 bg-stone-800 relative">
                        {z.imageUrl
                          ? <img src={z.imageUrl} alt={z.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><MapPin className="h-4 w-4 text-stone-600" /></div>
                        }
                        {isSelected && (
                          <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-stone-900 text-[9px] font-black">✓</div>
                        )}
                      </div>
                      <div className="px-2 py-1.5 w-full text-center">
                        <div className="text-[10px] font-medium text-stone-200 truncate">{z.name}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Room Images — only in edit mode (need room ID) */}
            {editingRoomId && (
              <div>
                <p className="text-xs font-semibold text-stone-400 mb-2.5 flex items-center gap-2">
                  <ImageIcon className="h-3.5 w-3.5" />
                  รูปภาพห้อง
                  <span className="text-stone-600 font-normal">(ไม่บังคับ)</span>
                </p>

                {/* Existing images grid */}
                {roomImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {roomImages.map(img => (
                      <div key={img.id} className="relative group rounded-xl overflow-hidden border border-white/10 aspect-video bg-stone-900">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        {/* Primary badge */}
                        {img.isPrimary && (
                          <div className="absolute top-1 left-1 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-stone-900">
                            <Star className="h-2.5 w-2.5" /> หลัก
                          </div>
                        )}
                        {/* Hover actions */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          {!img.isPrimary && (
                            <button
                              onClick={async () => {
                                // Set all to non-primary then set this one
                                await roomsApi.addImage(editingRoomId, { url: img.url, isPrimary: true })
                                qc.invalidateQueries({ queryKey: ['room-images', editingRoomId] })
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 transition-colors"
                              title="ตั้งเป็นรูปหลัก"
                            >
                              <Star className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteImageMutation.mutate(img.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
                            title="ลบรูป"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] py-3 text-xs text-stone-500 hover:border-amber-300/30 hover:text-amber-300 transition-colors">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {imgUploading ? 'กำลังอัปโหลด...' : '+ เพิ่มรูปภาพห้อง'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleRoomImgUpload} disabled={imgUploading} />
                </label>
                {roomImages.length === 0 && <p className="text-[10px] text-stone-700 mt-1.5 text-center">รูปแรกจะถูกตั้งเป็นรูปหลักอัตโนมัติ</p>}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setRoomStep(1)} className="flex-1">
                ← กลับ
              </Button>
              <Button
                onClick={submitRoom}
                loading={roomMutations.create.isPending || roomMutations.update.isPending}
                disabled={!roomForm.roomTypeId}
                className="flex-1"
              >
                {editingRoomId ? 'บันทึก' : '+ เพิ่มห้องพัก'}
              </Button>
            </div>
          </div>
        )}
      </PmsDialog>

      {/* ── Bulk Create Dialog ── */}
      <PmsDialog
        open={dialogMode === 'bulk'}
        onClose={closeDialog}
        title="เพิ่มห้องพักหลายห้อง"
        description={bulkStep === 1 ? 'กำหนดช่วงหมายเลขและประเภทห้อง' : `ตรวจสอบและแก้ไขก่อนสร้าง ${bulkRows.length} ห้อง`}
        size="xl"
      >
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-5">
          {[{ n: 1, label: 'ตั้งค่า' }, { n: 2, label: 'ตรวจสอบ & สร้าง' }].map(({ n, label }, i) => (
            <React.Fragment key={n}>
              <div className={cn('flex items-center gap-2 text-xs font-medium', bulkStep === n ? 'text-amber-300' : n < bulkStep ? 'text-stone-400' : 'text-stone-700')}>
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border', bulkStep === n ? 'bg-amber-400 border-amber-400 text-stone-900' : n < bulkStep ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-transparent border-stone-700 text-stone-600')}>
                  {n < bulkStep ? '✓' : n}
                </span>
                {label}
              </div>
              {i === 0 && <div className={cn('flex-1 h-px', bulkStep > 1 ? 'bg-emerald-500/40' : 'bg-white/10')} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1 */}
        {bulkStep === 1 && (
          <div className="space-y-4">
            {/* Type + Zone — compact 2-row section */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-600 mb-2">ประเภทห้อง <span className="text-rose-400 normal-case">*</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {roomTypes.map(rt => (
                    <button key={rt.id} onClick={() => setBulkForm(p => ({...p, roomTypeId: rt.id}))}
                      className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border transition-all', bulkForm.roomTypeId === rt.id ? 'border-amber-400/60 bg-amber-400/15 text-amber-200' : 'border-white/10 text-stone-500 hover:border-white/20 hover:text-stone-300')}>
                      {rt.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-600 mb-2">โซน <span className="font-normal normal-case text-stone-700">(ไม่บังคับ)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setBulkForm(p => ({...p, zoneId: ''}))} className={cn('rounded-full px-3 py-1.5 text-xs border transition-all', !bulkForm.zoneId ? 'bg-amber-400/15 border-amber-300/30 text-amber-200' : 'border-white/10 text-stone-500 hover:border-white/20')}>ไม่ระบุ</button>
                  {zones.map(z => (
                    <button key={z.id} onClick={() => setBulkForm(p => ({...p, zoneId: z.id}))} className={cn('rounded-full px-3 py-1.5 text-xs border transition-all', bulkForm.zoneId === z.id ? 'bg-amber-400/15 border-amber-300/30 text-amber-200' : 'border-white/10 text-stone-500 hover:border-white/20')}>{z.name}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Range + floor + name pattern */}
            <div className="grid grid-cols-3 gap-3">
              <Input label="เริ่มจาก *" type="number" value={bulkForm.from} onChange={e => setBulkForm(p => ({...p, from: e.target.value}))} placeholder="101" />
              <Input label="ถึง *" type="number" value={bulkForm.to} onChange={e => setBulkForm(p => ({...p, to: e.target.value}))} placeholder="120" />
              <Input label="ชั้น" value={bulkForm.floorNo} onChange={e => setBulkForm(p => ({...p, floorNo: e.target.value}))} placeholder="1" />
            </div>

            <div>
              <Input
                label="รูปแบบชื่อห้อง (ไม่บังคับ)"
                value={bulkForm.namePattern}
                onChange={e => setBulkForm(p => ({...p, namePattern: e.target.value}))}
                placeholder='เช่น Garden View {num}'
              />
              {bulkForm.namePattern && bulkForm.from ? (
                <p className="text-[11px] text-stone-500 mt-1">
                  ตัวอย่าง → <span className="text-stone-300">{bulkForm.namePattern.replace('{num}', bulkForm.from).replace('{n}', bulkForm.from)}</span>
                </p>
              ) : (
                <p className="text-[11px] text-stone-700 mt-1">ใช้ {'{num}'} แทนเลขห้อง เช่น "วิวสวน {'{num}'}"</p>
              )}
            </div>

            {bulkForm.from && bulkForm.to && !isNaN(+bulkForm.from) && !isNaN(+bulkForm.to) && +bulkForm.to >= +bulkForm.from && (
              <div className="text-xs text-stone-500 text-center">
                จะสร้าง <span className="text-amber-300 font-semibold">{+bulkForm.to - +bulkForm.from + 1} ห้อง</span>
                {' '}({bulkForm.from}–{bulkForm.to})
              </div>
            )}

            <Button onClick={generateBulkPreview} className="w-full" disabled={!bulkForm.roomTypeId}>
              ดูตัวอย่างและแก้ไข →
            </Button>
          </div>
        )}

        {/* Step 2 — Editable table */}
        {bulkStep === 2 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
              <div className="grid grid-cols-3 gap-0 border-b border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-stone-600">
                <span>หมายเลขห้อง</span><span>ชื่อห้อง</span><span>ชั้น</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-white/[0.04]">
                {bulkRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 px-2 py-1.5 items-center">
                    <input value={row.roomNumber} onChange={e => setBulkRows(r => r.map((x, j) => j === i ? {...x, roomNumber: e.target.value} : x))}
                      className="rounded-lg bg-white/[0.04] border border-white/10 px-2 py-1 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-300/40 w-full" />
                    <input value={row.roomName} onChange={e => setBulkRows(r => r.map((x, j) => j === i ? {...x, roomName: e.target.value} : x))}
                      placeholder="(ไม่บังคับ)"
                      className="rounded-lg bg-white/[0.04] border border-white/10 px-2 py-1 text-xs text-stone-300 focus:outline-none focus:border-white/20 w-full" />
                    <input value={row.floorNo} onChange={e => setBulkRows(r => r.map((x, j) => j === i ? {...x, floorNo: e.target.value} : x))}
                      className="rounded-lg bg-white/[0.04] border border-white/10 px-2 py-1 text-xs text-stone-300 focus:outline-none focus:border-white/20 w-full" />
                  </div>
                ))}
              </div>
            </div>

            {bulkCreating && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-stone-500">
                  <span>กำลังสร้างห้องพัก...</span><span>{bulkProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-amber-400 transition-all duration-300" style={{ width: `${bulkProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setBulkStep(1)} disabled={bulkCreating} className="flex-1">← กลับ</Button>
              <Button onClick={submitBulk} loading={bulkCreating} className="flex-1">
                สร้าง {bulkRows.filter(r => r.roomNumber.trim()).length} ห้อง
              </Button>
            </div>
          </div>
        )}
      </PmsDialog>

      {/* ── Confirm Delete ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={`ลบ${deleteTarget?.type === 'zone' ? 'โซน' : deleteTarget?.type === 'roomType' ? 'ประเภทห้อง' : 'ห้องพัก'}`}
        description={`"${deleteTarget?.name}" จะถูกลบออกจากระบบ${deleteTarget?.type !== 'room' ? ' หากมีห้องพักอยู่จะไม่สามารถลบได้' : ''}`}
        confirmLabel="ลบ"
        variant="danger"
        loading={zoneMutations.delete.isPending || typeMutations.delete.isPending || roomMutations.delete.isPending}
      />
    </AppShell>
  )
}
