'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Save, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { propertiesApi, uploadApi } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'

export default function PropertySettingsPage() {
  const { user, updateUser } = useAuth()
  const qc = useQueryClient()
  const propertyId = user?.propertyId!

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertiesApi.get(propertyId).then(r => r.data),
    enabled: !!propertyId,
  })

  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '', timezone: 'Asia/Bangkok',
    checkInTime: '14:00', checkOutTime: '12:00',
    vatRate: '7', serviceChargeRate: '10', priceIncludeTax: 'false',
    backgroundImageUrl: '',
  })
  const [bgPreview, setBgPreview] = useState<string | null>(null)
  const [bgUploading, setBgUploading] = useState(false)

  useEffect(() => {
    if (property) {
      setForm({
        name: property.name || '',
        address: property.address || '',
        phone: property.phone || '',
        email: property.email || '',
        timezone: property.timezone || 'Asia/Bangkok',
        checkInTime: property.checkInTime || '14:00',
        checkOutTime: property.checkOutTime || '12:00',
        vatRate: String(property.vatRate ?? 7),
        serviceChargeRate: String(property.serviceChargeRate ?? 10),
        priceIncludeTax: String(property.priceIncludeTax ?? false),
        backgroundImageUrl: property.backgroundImageUrl || '',
      })
      if (property.backgroundImageUrl) setBgPreview(property.backgroundImageUrl)
    }
  }, [property])

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBgUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await uploadApi.uploadImage(formData)
      const url = res.data.url
      setBgPreview(url)
      setForm(p => ({ ...p, backgroundImageUrl: url }))
      toast.success('อัปโหลดรูปพื้นหลังสำเร็จ')
    } catch {
      toast.error('อัปโหลดรูปไม่สำเร็จ')
    } finally {
      setBgUploading(false)
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => propertiesApi.update(propertyId, {
      ...form,
      vatRate: Number(form.vatRate),
      serviceChargeRate: Number(form.serviceChargeRate),
      priceIncludeTax: form.priceIncludeTax === 'true',
      backgroundImageUrl: form.backgroundImageUrl || null,
    }),
    onSuccess: () => {
      // Refresh property query → AppBackground picks up new bg image
      qc.invalidateQueries({ queryKey: ['property', propertyId] })
      // Update Zustand auth store so header/dashboard name updates immediately (no Shift+F5)
      updateUser({ property: { id: propertyId, name: form.name } })
      toast.success('บันทึกข้อมูลที่พักสำเร็จ')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  if (isLoading) return <AppShell title="ข้อมูลที่พัก"><Skeleton className="h-96 w-full rounded-2xl" /></AppShell>

  return (
    <AppShell title="ข้อมูลที่พัก" subtitle="ตั้งค่าพื้นฐานของที่พัก">
      <div className="mx-auto max-w-2xl space-y-5">
        <GlassPanel padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-stone-100">ข้อมูลทั่วไป</h3>
          </div>
          <div className="space-y-4">
            <Input label="ชื่อที่พัก *" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
            <Input label="ที่อยู่" value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="เบอร์โทร" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} />
              <Input label="อีเมล" type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
            </div>
          </div>
        </GlassPanel>

        {/* Background Image */}
        <GlassPanel padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-stone-100">ภาพพื้นหลังระบบ</h3>
          </div>
          <p className="mb-4 text-xs text-stone-500">ภาพที่ใช้เป็น background ของระบบทั้งหมด แนะนำขนาด 1920×1080 px</p>

          {bgPreview && (
            <div className="mb-4 relative rounded-2xl overflow-hidden border border-white/10" style={{ aspectRatio: '16/6' }}>
              <img src={bgPreview} alt="background preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setBgPreview(null); setForm(p => ({ ...p, backgroundImageUrl: '' })) }}
                  className="rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-300 px-3 py-1.5 text-xs hover:bg-rose-500/30 transition-colors"
                >
                  ลบรูป
                </button>
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] py-6 text-sm text-stone-500 hover:border-amber-300/30 hover:text-amber-300 transition-colors">
            <ImageIcon className="h-4 w-4" />
            {bgUploading ? 'กำลังอัปโหลด...' : bgPreview ? 'เปลี่ยนรูปพื้นหลัง' : 'อัปโหลดรูปพื้นหลัง'}
            <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} disabled={bgUploading} />
          </label>
        </GlassPanel>

        <GlassPanel padding="lg">
          <h3 className="mb-4 text-sm font-semibold text-stone-100">เวลา Check-in / Check-out</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="เวลา Check-in" type="time" value={form.checkInTime} onChange={e => setForm(p => ({...p, checkInTime: e.target.value}))} />
            <Input label="เวลา Check-out" type="time" value={form.checkOutTime} onChange={e => setForm(p => ({...p, checkOutTime: e.target.value}))} />
          </div>
        </GlassPanel>

        <GlassPanel padding="lg">
          <h3 className="mb-4 text-sm font-semibold text-stone-100">ภาษีและ Service Charge</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="VAT (%)" type="number" value={form.vatRate} onChange={e => setForm(p => ({...p, vatRate: e.target.value}))} min="0" max="100" />
              <Input label="Service Charge (%)" type="number" value={form.serviceChargeRate} onChange={e => setForm(p => ({...p, serviceChargeRate: e.target.value}))} min="0" max="100" />
            </div>
            <Select value={form.priceIncludeTax} onValueChange={v => setForm(p => ({...p, priceIncludeTax: v}))}>
              <SelectTrigger label="ราคาที่แสดงรวมภาษีหรือไม่?"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">รวม VAT แล้ว (Inclusive)</SelectItem>
                <SelectItem value="false">ยังไม่รวม VAT (Exclusive)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </GlassPanel>

        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} className="w-full h-11">
          <Save className="h-4 w-4" /> บันทึกการเปลี่ยนแปลง
        </Button>
      </div>
    </AppShell>
  )
}
