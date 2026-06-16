'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { authApi } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, setAuth, logout } = useAuthStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.replace('/login')
      return
    }

    authApi.me()
      .then((res) => {
        const user = res.data
        const accessToken = localStorage.getItem('access_token') || ''
        const refreshToken = localStorage.getItem('refresh_token') || ''
        setAuth(user, accessToken, refreshToken)
        setLoading(false)
      })
      .catch(() => {
        logout()
        router.replace('/login')
      })
  }, [router, setAuth, logout])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#120d09]">
        <div className="space-y-3 w-64">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
