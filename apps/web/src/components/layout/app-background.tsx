'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { propertiesApi } from '@/lib/api'

const DEFAULT_BG = '/images/resort-lounge-bg.jpg'

interface AppBackgroundProps {
  children: React.ReactNode
}

export function AppBackground({ children }: AppBackgroundProps) {
  const { user } = useAuth()

  // Fetch property to get the custom background image (stale 10 min — rarely changes)
  const { data: property } = useQuery({
    queryKey: ['property', user?.propertyId],
    queryFn: () => propertiesApi.get(user!.propertyId!).then(r => r.data),
    enabled: !!user?.propertyId,
    staleTime: 10 * 60_000,
  })

  const bgUrl = property?.backgroundImageUrl || DEFAULT_BG

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#120d09] text-stone-100">
      {/* Background image — custom or default resort lounge */}
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center opacity-60 transition-all duration-1000"
        style={{ backgroundImage: `url('${bgUrl}')`, filter: 'blur(1px)' }}
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Warm ambient glow - top center */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[600px] -translate-x-1/2 rounded-full bg-amber-300/12 blur-[80px]" />
      {/* Warm glow - bottom right */}
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-orange-500/10 blur-[80px]" />
      {/* Cool subtle glow - bottom left */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-cyan-400/5 blur-[80px]" />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_70%,rgba(0,0,0,0.75)_100%)]" />

      {/* Content layer */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
