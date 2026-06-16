'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { GlassPanel } from '@/components/ui/glass-panel'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/api'

export default function ChangePinPage() {
  const router = useRouter()
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current')
  const [currentPin, setCurrentPin] = useState(['', '', '', '', '', ''])
  const [newPin, setNewPin] = useState(['', '', '', '', '', ''])
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const current = currentPin.join('')
    const newP = newPin.join('')
    const confirm = confirmPin.join('')
    if (newP !== confirm) { toast.error('PIN ใหม่ไม่ตรงกัน'); return }
    if (newP === '000000') { toast.error('ไม่สามารถใช้ PIN เริ่มต้นได้'); return }

    setLoading(true)
    try {
      await authApi.changePin(current, newP, confirm)
      toast.success('เปลี่ยน PIN สำเร็จ')
      router.push('/dashboard')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const PinRow = ({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) => (
    <div>
      <p className="mb-2 text-sm font-medium text-stone-300">{label}</p>
      <div className="flex gap-2">
        {value.map((d, i) => (
          <input key={i} type="password" inputMode="numeric" maxLength={1} value={d}
            onChange={e => {
              if (!/^\d?$/.test(e.target.value)) return
              const arr = [...value]; arr[i] = e.target.value; onChange(arr)
            }}
            className="h-12 w-10 rounded-xl border border-white/20 bg-black/25 text-center text-lg font-semibold text-stone-100 focus:border-amber-300/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
          />
        ))}
      </div>
    </div>
  )

  return (
    <AppShell title="เปลี่ยน PIN" subtitle="อัปเดต PIN เข้าระบบของคุณ">
      <div className="mx-auto max-w-sm">
        <GlassPanel padding="lg">
          <div className="space-y-6">
            <PinRow label="PIN ปัจจุบัน" value={currentPin} onChange={setCurrentPin} />
            <PinRow label="PIN ใหม่ (6 หลัก)" value={newPin} onChange={setNewPin} />
            <PinRow label="ยืนยัน PIN ใหม่" value={confirmPin} onChange={setConfirmPin} />
            <Button
              onClick={handleSubmit}
              loading={loading}
              className="w-full"
              disabled={currentPin.join('').length !== 6 || newPin.join('').length !== 6 || confirmPin.join('').length !== 6}
            >
              เปลี่ยน PIN
            </Button>
          </div>
        </GlassPanel>
      </div>
    </AppShell>
  )
}
