'use client'

import React, { useState, useMemo } from 'react'
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

// ── Column wrapper ─────────────────────────────────────────────
function Column({ title, icon: Icon, count, onAdd, addLabel, children, loading, className = '' }: {
  title: string; icon: React.ElementType; count?: number; onAdd: () => void; addLabel: string
  children: React.ReactNode; loading?: boolean; className?: string
}) {
  return (
    <div className={cn('flex flex-col rounded-2xl border border-white/[0.10] bg-black/20 backdrop-blur-sm overflow-hidden', className)}>
      {/* Column header — title + count only */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.07]">
        <Icon className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-stone-300">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-stone-500">{count}</span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading ? (
          <div className="space-y-1.5 p-1">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-xl" />)}</div>
        ) : children}
      </div>

      {/* Add button — pinned at bottom */}
      <div className="border-t border-white/[0.06] p-2">
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-2 text-xs text-stone-500 hover:border-amber-300/30 hover:text-amber-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </button>
      </div>
    </div>
  )
}

// ── Sortable zone row ─────────────────────────────────────────
function SortableZoneRow({ zone, isSelected, onClick, onEdit, onDelete, count }: {
  zone: Zone; isSelected: boolean; onClick: () => void
  onEdit: (e: React.MouseEvent) => void; onDelete: (e: React.MouseEvent) => void; count: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: zone.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn(
        'group relative flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-2.5 transition-all',
        isSelected ? 'bg-amber-400/15 border border-amber-300/25' : 'hover:bg-white/[0.05] border border-transparent'
      )}
      onClick={onClick}
    >
      {/* Drag handle */}
      <button
        {...attributes} {...listeners}
        onClick={e => e.stopPropagation()}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-stone-700 hover:text-stone-500 touch-none"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="flex flex-1 items-center gap-2.5 min-w-0">
        {zone.imageUrl ? (
          <img src={zone.imageUrl} alt={zone.name} className="h-8 w-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
        ) : (
          <div className="flex h-8 w-10 items-center justify-center rounded-lg bg-amber-400/10 flex-shrink-0">
            <MapPin className="h-3.5 w-3.5 text-amber-400/60" />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-stone-200">{zone.name}</div>
          <div className="text-[10px] text-stone-600">{ZONE_TYPES.find(t => t.value === zone.zoneType)?.label} · {count} ห้อง</div>
        </div>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={onEdit} className="flex h-6 w-6 items-center justify-center rounded-lg text-stone-500 hover:bg-white/[0.10] hover:text-stone-200 transition-colors"><Edit2 className="h-3 w-3" /></button>
        <button onClick={onDelete} className="flex h-6 w-6 items-center justify-center rounded-lg text-stone-500 hover:bg-rose-400/15 hover:text-rose-300 transition-colors"><Trash2 className="h-3 w-3" /></button>
      </div>

      {isSelected && <ChevronRight className="h-3 w-3 text-amber-400 flex-shrink-0 -mr-0.5" />}
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
  type DialogMode = 'zone' | 'roomType' | 'room' | null
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [editTarget, setEditTarget] = useState<Zone | RoomType | Room | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'zone' | 'roomType' | 'room' } | null>(null)

  // ── Forms ──
  const [zoneForm, setZoneForm] = useState({ name: '', zoneType: 'other', parentZoneId: '', imageUrl: '' })
  const [rtForm, setRtForm] = useState({ name: '', description: '', imageUrl: '', baseOccupancy: '2', maxOccupancy: '4', baseRate: '0' })
  const [roomForm, setRoomForm] = useState({ roomTypeId: '', zoneId: '', roomNumber: '', roomName: '', floorNo: '', maxOccupancy: '4' })
  const [roomStep, setRoomStep] = useState(1)
  const [imgUploading, setImgUploading] = useState(false)

  // ── Queries ──
  const { data: zonesData = [], isLoading: zonesLoading } = useQuery<Zone[]>({ queryKey: ['zones-flat'], queryFn: () => zonesApi.flat().then(r => r.data) })
  const [zonOrder, setZonOrder] = useState<string[]>([])
  // Sorted zones — local order takes priority once user drags
  const zones = useMemo(() => {
    if (zonOrder.length === 0) return zonesData
    return [...zonesData].sort((a, b) => zonOrder.indexOf(a.id) - zonOrder.indexOf(b.id))
  }, [zonesData, zonOrder])
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
      setZonOrder(newOrder)
      // Persist new order to backend
      newOrder.forEach((id, idx) => {
        zonesApi.update(id, { sortOrder: idx }).catch(() => {/* silent */})
      })
    }
  }

  const zoneMutations = {
    create: useMutation({ mutationFn: (d: Record<string, unknown>) => zonesApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-flat'] }); closeDialog(); toast.success('เพิ่มโซนสำเร็จ') }, onError: () => toast.error('เกิดข้อผิดพลาด') }),
    update: useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => zonesApi.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-flat'] }); closeDialog(); toast.success('แก้ไขสำเร็จ') }, onError: () => toast.error('เกิดข้อผิดพลาด') }),
    delete: useMutation({ mutationFn: (id: string) => zonesApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones-flat'] }); qc.invalidateQueries({ queryKey: ['rooms'] }); setZonOrder([]); toast.success('ลบสำเร็จ') }, onError: () => toast.error('ไม่สามารถลบโซนที่มีห้องพักอยู่ได้') }),
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

  // ── Delete confirm ──
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'zone') zoneMutations.delete.mutate(deleteTarget.id)
    else if (deleteTarget.type === 'roomType') typeMutations.delete.mutate(deleteTarget.id)
    else roomMutations.delete.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  // ── Status dot color ──
  const STATUS_DOT: Record<string, string> = {
    clean: 'bg-emerald-400', dirty: 'bg-amber-400', occupied: 'bg-rose-400',
    cleaning: 'bg-sky-400', out_of_order: 'bg-stone-500', inspected: 'bg-teal-400',
  }

  const colHeight = 'h-[calc(100vh-220px)] max-h-[640px]'

  return (
    <AppShell title="จัดการห้องพัก" subtitle="โซน · ประเภทห้อง · ห้องพัก">

      {/* Mobile breadcrumb nav */}
      <div className="flex items-center gap-2 mb-3 lg:hidden text-xs text-stone-500">
        {mobileCol > 0 && (
          <button onClick={() => setMobileCol(c => c - 1)} className="flex items-center gap-1 text-amber-400 hover:text-amber-300">
            <ChevronLeft className="h-3.5 w-3.5" /> กลับ
          </button>
        )}
        <span className={cn(mobileCol === 0 ? 'text-stone-200 font-medium' : '')}>โซน</span>
        {mobileCol >= 1 && <><ChevronRight className="h-3 w-3" /><span className={cn(mobileCol === 1 ? 'text-stone-200 font-medium' : '')}>ประเภทห้อง</span></>}
        {mobileCol >= 2 && <><ChevronRight className="h-3 w-3" /><span className="text-stone-200 font-medium">ห้องพัก</span></>}
      </div>

      {/* Desktop: 3 columns | Mobile: 1 column at a time */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">

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
          {/* "ทั้งหมด" option */}
          <div
            onClick={() => { setSelectedZoneId(null); setSelectedRoomTypeId(null) }}
            className={cn(
              'flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all',
              !selectedZoneId ? 'bg-amber-400/15 border border-amber-300/25' : 'hover:bg-white/[0.05] border border-transparent'
            )}
          >
            <span className="text-xs font-medium text-stone-300">ทั้งหมด</span>
            <span className="text-[10px] text-stone-600">{rooms.length} ห้อง</span>
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
          {/* "ทั้งหมด" option */}
          <div
            onClick={() => setSelectedRoomTypeId(null)}
            className={cn(
              'flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-all',
              !selectedRoomTypeId ? 'bg-amber-400/15 border border-amber-300/25' : 'hover:bg-white/[0.05] border border-transparent'
            )}
          >
            <span className="text-xs font-medium text-stone-300">ทั้งหมด</span>
            <span className="text-[10px] text-stone-600">
              {selectedZoneId ? (roomCountByZone[selectedZoneId] || 0) : rooms.length} ห้อง
            </span>
          </div>

          {roomTypes.length === 0 && !typesLoading && (
            <div className="flex flex-col items-center gap-2 py-8 text-stone-600">
              <Layers className="h-8 w-8 opacity-40" />
              <p className="text-xs">ยังไม่มีประเภทห้อง</p>
            </div>
          )}

          {roomTypes.map(rt => {
            const count = roomCountByType[rt.id] || 0
            if (selectedZoneId && count === 0) return null
            return (
              <ActionRow
                key={rt.id}
                isSelected={selectedRoomTypeId === rt.id}
                onClick={() => { setSelectedRoomTypeId(rt.id); if (window.innerWidth < 1024) setMobileCol(2) }}
                onEdit={e => openTypeEdit(rt, e)}
                onDelete={e => { e.stopPropagation(); setDeleteTarget({ id: rt.id, name: rt.name, type: 'roomType' }) }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {rt.imageUrl ? (
                    <img src={rt.imageUrl} alt={rt.name} className="h-8 w-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                  ) : (
                    <div className="flex h-8 w-10 items-center justify-center rounded-lg bg-stone-700/50 flex-shrink-0">
                      <Layers className="h-3.5 w-3.5 text-stone-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-stone-200">{rt.name}</div>
                    <div className="text-[10px] text-stone-600">{formatCurrency(Number(rt.baseRate))} · {count} ห้อง</div>
                  </div>
                </div>
              </ActionRow>
            )
          })}
        </Column>

        {/* ── Column 3: Rooms ── */}
        <Column
          title="ห้องพัก"
          icon={BedDouble}
          count={filteredRooms.length}
          onAdd={openRoomCreate}
          addLabel="เพิ่มห้องพัก"
          loading={roomsLoading}
          className={cn(colHeight, mobileCol !== 2 && 'hidden lg:flex')}
        >
          {filteredRooms.length === 0 && !roomsLoading && (
            <div className="flex flex-col items-center gap-2 py-8 text-stone-600">
              <BedDouble className="h-8 w-8 opacity-40" />
              <p className="text-xs">ยังไม่มีห้องพัก</p>
              <button onClick={openRoomCreate} className="text-[10px] text-amber-400 hover:text-amber-300 underline">+ เพิ่มห้องพัก</button>
            </div>
          )}

          {/* Floor cross-section grid — group by floorNo */}
          {filteredRooms.length > 0 && (() => {
            const floorMap = new Map<string, Room[]>()
            filteredRooms.forEach(r => {
              const floor = r.floorNo || 'ไม่ระบุชั้น'
              if (!floorMap.has(floor)) floorMap.set(floor, [])
              floorMap.get(floor)!.push(r)
            })
            // Sort floors: numeric first, then non-numeric
            const sortedFloors = Array.from(floorMap.keys()).sort((a, b) => {
              const na = Number(a), nb = Number(b)
              if (!isNaN(na) && !isNaN(nb)) return na - nb
              return a.localeCompare(b, 'th')
            })
            return sortedFloors.map(floor => (
              <div key={floor} className="mb-3">
                {/* Floor label */}
                <div className="flex items-center gap-2 px-1 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">
                    {floor === 'ไม่ระบุชั้น' ? floor : `ชั้น ${floor}`}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[9px] text-stone-700">{floorMap.get(floor)!.length} ห้อง</span>
                </div>
                {/* Room tiles */}
                <div className="grid grid-cols-3 gap-1.5">
                  {floorMap.get(floor)!.map(room => (
                    <div key={room.id} className="group relative">
                      <div className={cn(
                        'relative rounded-xl border p-2 cursor-pointer transition-all',
                        'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/15'
                      )}>
                        {/* Status dot */}
                        <div className={cn('absolute top-1.5 right-1.5 h-2 w-2 rounded-full', STATUS_DOT[room.currentStatus] || 'bg-stone-600')} />
                        {/* Room number */}
                        <div className="text-sm font-black font-mono text-amber-300 leading-none">{room.roomNumber}</div>
                        {/* Room type */}
                        <div className="text-[9px] text-stone-400 mt-1 truncate leading-tight">{room.roomType.name}</div>
                        {/* Zone name */}
                        {room.zone && (
                          <div className="text-[9px] text-stone-600 truncate leading-tight">{room.zone.name}</div>
                        )}
                        {/* Hover actions */}
                        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 rounded-xl transition-opacity">
                          <button
                            onClick={e => openRoomEdit(room, e)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-stone-200 hover:bg-white/25 transition-colors"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteTarget({ id: room.id, name: `ห้อง ${room.roomNumber}`, type: 'room' }) }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/35 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
