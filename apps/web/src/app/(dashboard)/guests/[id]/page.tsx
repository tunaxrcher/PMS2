'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft, User, Phone, Mail, Globe, CreditCard, Calendar,
  MapPin, MessageSquare, AlertTriangle, BookOpen, Edit2, Eye, EyeOff,
  CheckCircle2, XCircle, DoorOpen, DoorClosed
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { guestsApi } from '@/lib/api'
import { formatDate, formatCurrency, calcNights, formatPhone } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { StaggerList, StaggerItem } from '@/components/ui/page-transition'

export default function GuestProfilePage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [showSensitive, setShowSensitive] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<{
    firstName: string; lastName: string; phone: string; email: string
    nationality: string; idType: string; idNumber: string; address: string; remark: string
    blacklistFlag: boolean
  }>({
    firstName: '', lastName: '', phone: '', email: '',
    nationality: '', idType: '', idNumber: '', address: '', remark: '', blacklistFlag: false
  })

  const { data: guest, isLoading } = useQuery({
    queryKey: ['guest', id, showSensitive],
    queryFn: () => guestsApi.get(id, showSensitive).then(r => r.data),
  })

  const { data: bookingHistory } = useQuery({
    queryKey: ['guest-bookings', id],
    queryFn: () => guestsApi.bookings(id).then(r => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => guestsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guest', id] })
      qc.invalidateQueries({ queryKey: ['guests'] })
      setEditOpen(false)
      toast.success('แก้ไขข้อมูลสำเร็จ')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const openEdit = () => {
    if (!guest) return
    setEditForm({
      firstName: guest.firstName || '',
      lastName: guest.lastName || '',
      phone: guest.phone || '',
      email: guest.email || '',
      nationality: guest.nationality || '',
      idType: guest.idType || '',
      idNumber: '',
      address: guest.address || '',
      remark: guest.remark || '',
      blacklistFlag: guest.blacklistFlag || false,
    })
    setEditOpen(true)
  }

  const totalSpend = (bookingHistory as Array<{
    folios?: Array<{ payments?: Array<{ amount: number | string; status: string }> }>
  }> || []).reduce((sum, b) => {
    return sum + (b.folios || []).reduce((fs, f) => {
      return fs + (f.payments || []).filter(p => p.status === 'paid').reduce((ps, p) => ps + Number(p.amount), 0)
    }, 0)
  }, 0)

  if (isLoading) {
    return (
      <AppShell title="โปรไฟล์ลูกค้า">
        <div className="space-y-5">
          {/* Profile header card */}
          <div className="rounded-3xl border border-white/15 bg-white/[0.04] p-6">
            <div className="flex items-start gap-5">
              <Skeleton className="h-20 w-20 flex-shrink-0 rounded-2xl" />
              <div className="flex-1 min-w-0 space-y-3">
                <Skeleton className="h-6 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="flex gap-6">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </div>
          </div>
          {/* Stat / history cards */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </AppShell>
    )
  }

  if (!guest) return null

  const canViewSensitive = hasPermission('guest.view_sensitive')

  return (
    <AppShell
      title="โปรไฟล์ลูกค้า"
      subtitle={`${guest.firstName} ${guest.lastName}`}
      headerActions={
        <div className="flex gap-2">
          <Link href="/guests"><Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" /> กลับ</Button></Link>
          <Button size="sm" onClick={openEdit}><Edit2 className="h-4 w-4" /> แก้ไข</Button>
        </div>
      }
    >
      <StaggerList className="space-y-5">
        {/* Profile header card */}
        <StaggerItem>
          <motion.div
            className="rounded-3xl border border-white/15 bg-black/30 backdrop-blur-xl p-6 overflow-hidden relative"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Ambient glow */}
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-bold border ${guest.blacklistFlag ? 'bg-rose-400/15 border-rose-300/30 text-rose-300' : 'bg-amber-400/15 border-amber-300/20 text-amber-300'}`}>
                {guest.firstName[0]}{guest.lastName[0]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-stone-50">{guest.firstName} {guest.lastName}</h2>
                  {guest.blacklistFlag && (
                    <span className="flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-400/15 px-3 py-0.5 text-xs font-semibold text-rose-300">
                      <AlertTriangle className="h-3 w-3" /> Blacklist
                    </span>
                  )}
                  {guest.nationality && (
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-0.5 text-xs text-stone-400">
                      🌏 {guest.nationality}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {guest.phone && (
                    <div className="flex items-center gap-1.5 text-stone-400">
                      <Phone className="h-3.5 w-3.5 text-stone-600" />
                      <span className="font-mono">{formatPhone(guest.phone)}</span>
                    </div>
                  )}
                  {guest.email && (
                    <div className="flex items-center gap-1.5 text-stone-400">
                      <Mail className="h-3.5 w-3.5 text-stone-600" />
                      {guest.email}
                    </div>
                  )}
                  {guest.address && (
                    <div className="flex items-center gap-1.5 text-stone-400">
                      <MapPin className="h-3.5 w-3.5 text-stone-600" />
                      <span className="truncate max-w-xs">{guest.address}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="mt-4 flex gap-4">
                  {[
                    { label: 'เข้าพักทั้งหมด', value: (bookingHistory as unknown[] || []).length + ' ครั้ง' },
                    { label: 'ยอดใช้จ่ายรวม', value: formatCurrency(totalSpend) },
                    { label: 'เข้าพักล่าสุด', value: (bookingHistory as Array<{ checkInDate: string }> || []).length > 0 ? formatDate((bookingHistory as Array<{ checkInDate: string }>)[0].checkInDate, 'dd/MM/yyyy') : '-' },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <div className="text-xs text-stone-500">{stat.label}</div>
                      <div className="text-sm font-semibold text-stone-200 mt-0.5">{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </StaggerItem>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* ID / Sensitive info */}
          <StaggerItem>
            <GlassPanel padding="md">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-stone-100">ข้อมูลบัตร</h3>
                </div>
                {canViewSensitive && (
                  <button onClick={() => setShowSensitive(!showSensitive)}
                    className="flex items-center gap-1 text-xs text-stone-500 hover:text-amber-300 transition-colors">
                    {showSensitive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showSensitive ? 'ซ่อน' : 'แสดง'}
                  </button>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">ประเภทบัตร</span>
                  <span className="text-stone-300">{guest.idType === 'citizen_id' ? 'บัตรประชาชน' : guest.idType === 'passport' ? 'พาสปอร์ต' : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">หมายเลขบัตร</span>
                  <span className="font-mono text-stone-300">{guest.idNumber || '-'}</span>
                </div>
                {guest.dateOfBirth && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">วันเกิด</span>
                    <span className="text-stone-300">{formatDate(guest.dateOfBirth, 'dd/MM/yyyy')}</span>
                  </div>
                )}
              </div>
            </GlassPanel>
          </StaggerItem>

          {/* Notes */}
          <StaggerItem className="lg:col-span-2">
            <GlassPanel padding="md">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-stone-100">หมายเหตุ</h3>
              </div>
              <p className="text-sm text-stone-400 leading-relaxed">
                {guest.remark || 'ไม่มีหมายเหตุ'}
              </p>
            </GlassPanel>
          </StaggerItem>
        </div>

        {/* Booking History */}
        <StaggerItem>
          <GlassPanel dense padding="none">
            <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
              <BookOpen className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-stone-100">ประวัติการเข้าพัก</h3>
              <span className="ml-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[0.625rem] font-bold text-amber-300">
                {(bookingHistory as unknown[] || []).length}
              </span>
            </div>

            {!(bookingHistory as unknown[] || []).length ? (
              <div className="flex flex-col items-center gap-2 p-8 text-stone-500">
                <BookOpen className="h-8 w-8 opacity-30" />
                <p className="text-sm">ยังไม่มีประวัติการเข้าพัก</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      {['หมายเลขจอง', 'Check-in', 'Check-out', 'คืน', 'ห้อง', 'สถานะ', 'ยอดรวม', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-stone-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(bookingHistory as Array<{
                      id: string; bookingNumber: string; checkInDate: string; checkOutDate: string; status: string
                      bookingRooms: Array<{ room?: { roomNumber: string } | null; roomType: { name: string } }>
                      folios?: Array<{ payments?: Array<{ amount: number | string; status: string }> }>
                    }>).map((b) => {
                      const nights = calcNights(b.checkInDate, b.checkOutDate)
                      const paid = (b.folios || []).reduce((sum, f) => sum + (f.payments || []).filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0), 0)
                      return (
                        <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-amber-300">{b.bookingNumber}</td>
                          <td className="px-4 py-3 text-stone-300">{formatDate(b.checkInDate, 'dd/MM/yy')}</td>
                          <td className="px-4 py-3 text-stone-300">{formatDate(b.checkOutDate, 'dd/MM/yy')}</td>
                          <td className="px-4 py-3 text-stone-400 text-center">{nights}</td>
                          <td className="px-4 py-3 text-stone-400">{b.bookingRooms[0]?.room?.roomNumber || b.bookingRooms[0]?.roomType?.name || '-'}</td>
                          <td className="px-4 py-3"><StatusBadge status={b.status} size="sm" /></td>
                          <td className="px-4 py-3 text-right font-medium text-stone-200">{paid > 0 ? formatCurrency(paid) : '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/bookings/${b.id}`}>
                              <Button variant="ghost" size="sm" className="text-xs">ดู</Button>
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassPanel>
        </StaggerItem>
      </StaggerList>

      {/* Edit Dialog */}
      <PmsDialog open={editOpen} onClose={() => setEditOpen(false)} title="แก้ไขข้อมูลลูกค้า" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="ชื่อ *" value={editForm.firstName} onChange={e => setEditForm(p => ({...p, firstName: e.target.value}))} />
            <Input label="นามสกุล *" value={editForm.lastName} onChange={e => setEditForm(p => ({...p, lastName: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="เบอร์โทร" type="tel" inputMode="numeric" value={editForm.phone} onChange={e => setEditForm(p => ({...p, phone: e.target.value.replace(/\D/g,'').slice(0,10)}))} />
            <Input label="อีเมล" type="email" value={editForm.email} onChange={e => setEditForm(p => ({...p, email: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="สัญชาติ" value={editForm.nationality} onChange={e => setEditForm(p => ({...p, nationality: e.target.value}))} placeholder="ไทย" />
            <Select value={editForm.idType} onValueChange={v => setEditForm(p => ({...p, idType: v}))}>
              <SelectTrigger label="ประเภทบัตร"><SelectValue placeholder="เลือก" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="citizen_id">บัตรประชาชน</SelectItem>
                <SelectItem value="passport">พาสปอร์ต</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {editForm.idType && <Input label="หมายเลขบัตร (ใส่ใหม่เพื่อแก้ไข)" value={editForm.idNumber} onChange={e => setEditForm(p => ({...p, idNumber: e.target.value}))} placeholder="เว้นว่างไว้ถ้าไม่ต้องการแก้" />}
          <Input label="ที่อยู่" value={editForm.address} onChange={e => setEditForm(p => ({...p, address: e.target.value}))} />
          <Input label="หมายเหตุ" value={editForm.remark} onChange={e => setEditForm(p => ({...p, remark: e.target.value}))} placeholder="หมายเหตุเพิ่มเติม..." />
          <div className="flex items-center gap-3">
            <input type="checkbox" id="blacklist" checked={editForm.blacklistFlag} onChange={e => setEditForm(p => ({...p, blacklistFlag: e.target.checked}))}
              className="h-4 w-4 rounded accent-rose-500" />
            <label htmlFor="blacklist" className="text-sm text-rose-400 font-medium">ขึ้น Blacklist</label>
          </div>
          <Button
            onClick={() => updateMutation.mutate(editForm as Record<string, unknown>)}
            loading={updateMutation.isPending}
            className="w-full"
          >
            บันทึกการเปลี่ยนแปลง
          </Button>
        </div>
      </PmsDialog>
    </AppShell>
  )
}
