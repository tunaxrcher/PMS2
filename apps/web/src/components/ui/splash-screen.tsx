'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface SplashScreenProps {
  visible: boolean
  userName?: string
}

export function SplashScreen({ visible, userName }: SplashScreenProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#120d09]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          {/* Background glow */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/10 blur-[100px]" />

          {/* Background image subtle */}
          <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/images/resort-lounge-bg.jpg')" }} />
          <div className="absolute inset-0 bg-black/60" />

          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Logo animate */}
            <motion.div
              className="relative h-16 w-52"
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: 'backOut' }}
            >
              <Image src="/images/logo.png" alt="Serene PMS" fill className="object-contain" priority />
            </motion.div>

            {/* Greeting */}
            {userName && (
              <motion.p
                className="text-lg font-medium text-stone-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                ยินดีต้อนรับ, <span className="text-amber-300 font-semibold">{userName}</span>
              </motion.p>
            )}

            {/* Loading dots */}
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-amber-400"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                />
              ))}
            </motion.div>

            <motion.p
              className="text-xs text-stone-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              กำลังเข้าสู่ระบบ...
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
