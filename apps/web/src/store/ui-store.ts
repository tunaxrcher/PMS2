'use client'

import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void

  // Room grid state
  gridFrom: string
  gridTo: string
  gridZoneFilter: string | null
  gridRoomTypeFilter: string | null
  setGridRange: (from: string, to: string) => void
  setGridZoneFilter: (zoneId: string | null) => void
  setGridRoomTypeFilter: (rtId: string | null) => void
}

function getDefaultGridRange() {
  const today = new Date()
  const from = today.toISOString().split('T')[0]
  const to = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return { from, to }
}

export const useUIStore = create<UIState>((set) => {
  const { from, to } = getDefaultGridRange()
  return {
    sidebarCollapsed: false,
    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

    gridFrom: from,
    gridTo: to,
    gridZoneFilter: null,
    gridRoomTypeFilter: null,
    setGridRange: (from, to) => set({ gridFrom: from, gridTo: to }),
    setGridZoneFilter: (zoneId) => set({ gridZoneFilter: zoneId }),
    setGridRoomTypeFilter: (rtId) => set({ gridRoomTypeFilter: rtId }),
  }
})
