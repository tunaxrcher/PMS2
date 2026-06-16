'use client'

import { useAuthStore } from '@/store/auth-store'

export function useAuth() {
  const { user, isAuthenticated, logout, setAuth, updateUser } = useAuthStore()

  const hasPermission = (permission: string): boolean => {
    if (!user) return false
    return user.permissions.includes(permission)
  }

  const hasRole = (role: string): boolean => {
    if (!user) return false
    return user.roles.includes(role)
  }

  const isAdmin = user?.roles.includes('admin') ?? false
  const isFrontDesk = user?.roles.includes('front_desk') ?? false
  const isHousekeeping = user?.roles.includes('housekeeping') ?? false

  return {
    user,
    isAuthenticated,
    isAdmin,
    isFrontDesk,
    isHousekeeping,
    hasPermission,
    hasRole,
    logout,
    setAuth,
    updateUser,
  }
}
