'use client'

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(0, 0, 0, 0.75)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#f5f5f4',
            backdropFilter: 'blur(20px)',
          },
          classNames: {
            success: 'border-emerald-300/20',
            error: 'border-rose-300/20',
            warning: 'border-amber-300/20',
          },
        }}
      />
    </QueryClientProvider>
  )
}
