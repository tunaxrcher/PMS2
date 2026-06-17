'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Phone, ArrowRight, AlertTriangle, Shield, Crown, ConciergeBell, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { PmsDialog } from '@/components/ui/pms-dialog'
import { Button } from '@/components/ui/button'
import { AppBackground } from '@/components/layout/app-background'
import { SplashScreen } from '@/components/ui/splash-screen'

const MAX_PIN_ATTEMPTS = 3

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()

  const [phone, setPhone] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)

  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinAttempts, setPinAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null)
  const [lockCountdown, setLockCountdown] = useState(0)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  const [showSplash, setShowSplash] = useState(false)
  const [splashName, setSplashName] = useState('')

  const [changePinDialogOpen, setChangePinDialogOpen] = useState(false)
  const [newPin, setNewPin] = useState(['', '', '', '', '', ''])
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', ''])
  const [changePinLoading, setChangePinLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) router.push('/dashboard')
  }, [router])

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) return
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockedUntil(null)
        setLockCountdown(0)
        setPinAttempts(0)
        setPinError('')
      } else {
        setLockCountdown(remaining)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(val)
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (phone.length < 9) { toast.error('กรุณากรอกเบอร์โทรให้ถูกต้อง'); return }
    setPhoneLoading(true)
    try {
      await authApi.verifyPhone(phone)
      setPinDialogOpen(true)
      setPin(['', '', '', '', '', ''])
      setPinError('')
      setPinAttempts(0)
      setTimeout(() => pinRefs.current[0]?.focus(), 150)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'ไม่พบเบอร์โทรในระบบ'
      toast.error(msg)
    } finally {
      setPhoneLoading(false)
    }
  }

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    if (lockedUntil) return
    const newPinArr = [...pin]
    newPinArr[index] = value
    setPin(newPinArr)
    setPinError('')
    if (value && index < 5) pinRefs.current[index + 1]?.focus()
    if (newPinArr.every((d) => d !== '') && newPinArr.join('').length === 6) {
      handlePinSubmit(newPinArr.join(''))
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus()
    }
  }

  const handlePinSubmit = async (pinValue?: string) => {
    const pinStr = pinValue || pin.join('')
    if (pinStr.length !== 6 || lockedUntil) return

    setPinLoading(true)
    setPinError('')
    try {
      const res = await authApi.login(phone, pinStr)
      const { accessToken, refreshToken, user } = res.data
      setAuth(user, accessToken, refreshToken)
      setPinDialogOpen(false)

      if (user.mustChangePinOnLogin) {
        setChangePinDialogOpen(true)
        setNewPin(['', '', '', '', '', ''])
        setConfirmPin(['', '', '', '', '', ''])
      } else {
        // Show splash screen
        setSplashName(user.firstName)
        setShowSplash(true)
        setTimeout(() => {
          router.push('/dashboard')
        }, 2200)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'PIN ไม่ถูกต้อง'
      const newAttempts = pinAttempts + 1
      setPinAttempts(newAttempts)

      if (newAttempts >= MAX_PIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + 5 * 60 * 1000) // 5 min lockout
        setLockedUntil(lockUntil)
        setPinError(`ใส่ PIN ผิดเกิน ${MAX_PIN_ATTEMPTS} ครั้ง กรุณารอ 5 นาที`)
        toast.error('บัญชีถูกล็อคชั่วคราว กรุณารอ 5 นาที')
      } else {
        const remaining = MAX_PIN_ATTEMPTS - newAttempts
        setPinError(`PIN ไม่ถูกต้อง — เหลืออีก ${remaining} ครั้ง`)
      }

      setPin(['', '', '', '', '', ''])
      setTimeout(() => pinRefs.current[0]?.focus(), 50)
    } finally {
      setPinLoading(false)
    }
  }

  const handleChangePinSubmit = async () => {
    const newPinStr = newPin.join('')
    const confirmPinStr = confirmPin.join('')
    if (newPinStr.length !== 6 || confirmPinStr.length !== 6) { toast.error('กรุณากรอก PIN ให้ครบ 6 หลัก'); return }
    if (newPinStr !== confirmPinStr) { toast.error('PIN ไม่ตรงกัน'); return }
    if (newPinStr === '000000') { toast.error('ไม่สามารถใช้ PIN เริ่มต้นได้'); return }
    setChangePinLoading(true)
    try {
      await authApi.changePin('000000', newPinStr, confirmPinStr)
      setChangePinDialogOpen(false)
      toast.success('เปลี่ยน PIN สำเร็จ กรุณา Login ใหม่')
      useAuthStore.getState().logout()
      setPhone('')
      setPin(['', '', '', '', '', ''])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'เกิดข้อผิดพลาด'
      toast.error(msg)
    } finally {
      setChangePinLoading(false)
    }
  }

  const isLocked = !!lockedUntil

  return (
    <>
      <SplashScreen visible={showSplash} userName={splashName} />

      <AppBackground>
        <div className="flex min-h-screen items-center justify-center p-4">
          <motion.div
            className="w-full max-w-sm"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Logo */}
            <motion.div className="mb-8 flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}>
              <div className="relative mb-4 h-14 w-48">
                <Image src="/images/logo.png" alt="Serene PMS" fill className="object-contain" priority />
              </div>
              <h1 className="text-2xl font-semibold text-stone-100">เข้าสู่ระบบ</h1>
              <p className="mt-1 text-sm text-stone-500">กรุณากรอกเบอร์โทรศัพท์ของคุณ</p>
            </motion.div>

          {/* Card */}
          <motion.div
            className="rounded-3xl border border-white/15 bg-black/35 p-6 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <form onSubmit={handlePhoneSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-300">เบอร์โทรศัพท์</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                      <Phone className="h-4 w-4 text-stone-500" />
                    </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="0XXXXXXXXX"
                    maxLength={10}
                    required
                    className="h-11 w-full rounded-xl border border-white/15 bg-black/25 pl-10 pr-4 text-stone-100 placeholder:text-stone-600 focus:border-amber-300/40 focus:outline-none focus:ring-2 focus:ring-amber-400/20 backdrop-blur-sm transition-colors tracking-widest text-base"
                  />
                  </div>
                </div>

                <Button type="submit" loading={phoneLoading} className="w-full h-11"
                  disabled={phone.length < 9}>
                  {!phoneLoading && <ArrowRight className="h-4 w-4" />}
                  ถัดไป
                </Button>
              </form>
            </motion.div>

          {/* Quick role select */}
          <motion.div
            className="mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <p className="mb-2 text-center text-[0.625rem] text-stone-700">For Development</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { role: 'Admin', phone: '0800000001', icon: Crown, color: 'hover:border-amber-300/30 hover:bg-amber-400/8 hover:text-amber-400' },
                { role: 'Front Desk', phone: '0800000002', icon: ConciergeBell, color: 'hover:border-sky-300/30 hover:bg-sky-400/8 hover:text-sky-400' },
                { role: 'Housekeeping', phone: '0800000003', icon: Sparkles, color: 'hover:border-emerald-300/30 hover:bg-emerald-400/8 hover:text-emerald-400' },
              ].map(({ role, phone: rolePhone, icon: Icon, color }) => (
                <motion.button
                  key={role}
                  type="button"
                  onClick={() => setPhone(rolePhone)}
                  whileTap={{ scale: 0.96 }}
                  className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 px-2 transition-all duration-150 group ${color} ${
                    phone === rolePhone
                      ? 'border-amber-300/35 bg-amber-400/[0.08] text-amber-300'
                      : 'border-white/[0.07] bg-white/[0.03] text-stone-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[0.625rem] font-medium leading-none">{role}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          <motion.p className="mt-3 text-center text-[0.625rem] text-stone-700"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            Serene PMS v1.0 — Property Management System
          </motion.p>
          </motion.div>
        </div>

        {/* PIN Dialog */}
        <PmsDialog open={pinDialogOpen} onClose={() => { setPinDialogOpen(false); setPinAttempts(0); setLockedUntil(null) }}
          title="กรอก PIN" description="กรุณากรอก PIN 6 หลักของคุณ" size="sm">
          <div className="space-y-5">
            {/* Phone display */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-center text-sm text-stone-300">
              <Phone className="mr-2 inline h-4 w-4 text-stone-500" />
              <span className="tracking-widest">{phone}</span>
            </div>

            {/* Locked state */}
            {isLocked && (
              <motion.div
                className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 flex items-center gap-3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Shield className="h-5 w-5 text-rose-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-rose-300">บัญชีถูกล็อคชั่วคราว</p>
                  <p className="text-xs text-rose-400/80 mt-0.5">
                    ลองใหม่ได้ในอีก <span className="font-bold text-rose-300">{Math.floor(lockCountdown/60)}:{String(lockCountdown%60).padStart(2,'0')}</span>
                  </p>
                </div>
              </motion.div>
            )}

            {/* PIN inputs */}
            <div className="flex justify-center gap-2">
              {pin.map((digit, i) => (
                <motion.input
                  key={i}
                  ref={(el) => { pinRefs.current[i] = el }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  disabled={isLocked}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className={`h-12 w-10 rounded-xl border text-center text-lg font-semibold text-stone-100 bg-black/25 backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/30 ${
                    isLocked
                      ? 'border-rose-400/30 opacity-50 cursor-not-allowed'
                      : pinError
                      ? 'border-rose-400/60 focus:border-rose-400/80'
                      : digit
                      ? 'border-amber-300/50 bg-amber-400/10'
                      : 'border-white/20 hover:border-white/35'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-stone-300">PIN: 000000 เพื่อทดสอบ</p>

            {/* Error message + attempt warning */}
            <AnimatePresence mode="wait">
              {pinError && !isLocked && (
                <motion.div
                  className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2"
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                  <p className="text-sm text-rose-300">{pinError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Attempt indicator */}
            {!isLocked && pinAttempts > 0 && (
              <div className="flex justify-center gap-1.5">
                {[...Array(MAX_PIN_ATTEMPTS)].map((_, i) => (
                  <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i < pinAttempts ? 'bg-rose-400' : 'bg-white/10'}`} />
                ))}
              </div>
            )}

            <Button
              onClick={() => handlePinSubmit()}
              loading={pinLoading}
              className="w-full h-11"
              disabled={pin.join('').length !== 6 || pinLoading || isLocked}
            >
              เข้าสู่ระบบ
            </Button>
          </div>
        </PmsDialog>

        {/* Force Change PIN Dialog */}
        <PmsDialog open={changePinDialogOpen} onClose={() => {}} title="ตั้ง PIN ใหม่"
          description="บัญชีของคุณต้องตั้ง PIN ใหม่ก่อนใช้งาน" size="sm" showLogo>
          <div className="space-y-5">
            {[
              { label: 'PIN ใหม่ (6 หลัก)', arr: newPin, setArr: setNewPin },
              { label: 'ยืนยัน PIN ใหม่', arr: confirmPin, setArr: setConfirmPin }
            ].map(({ label, arr, setArr }) => (
              <div key={label}>
                <p className="mb-2 text-xs font-medium text-stone-400">{label}</p>
                <div className="flex gap-2">
                  {arr.map((d, i) => (
                    <input key={i} type="password" inputMode="numeric" maxLength={1} value={d}
                      onChange={e => {
                        if (!/^\d?$/.test(e.target.value)) return
                        const a = [...arr]; a[i] = e.target.value; setArr(a)
                      }}
                      className="h-12 w-10 rounded-xl border border-white/20 bg-black/25 text-center text-lg font-semibold text-stone-100 focus:border-amber-300/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-colors"
                    />
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={handleChangePinSubmit} loading={changePinLoading} className="w-full h-11"
              disabled={newPin.join('').length !== 6 || confirmPin.join('').length !== 6}>
              ยืนยัน PIN ใหม่
            </Button>
          </div>
        </PmsDialog>
      </AppBackground>
    </>
  )
}
