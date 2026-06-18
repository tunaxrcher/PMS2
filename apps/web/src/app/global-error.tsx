'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isChunkError = error?.name === 'ChunkLoadError' || error?.message?.includes('Loading chunk')

  useEffect(() => {
    // Auto-reload on ChunkLoadError (stale chunk after deploy / hot-reload race)
    if (isChunkError) {
      window.location.reload()
    }
  }, [isChunkError])

  if (isChunkError) {
    return (
      <html>
        <body className="flex h-screen items-center justify-center bg-[#120d09] text-stone-100">
          <div className="text-center space-y-3">
            <div className="text-sm text-stone-500 animate-pulse">กำลังโหลดใหม่...</div>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html>
      <body className="flex h-screen items-center justify-center bg-[#120d09] text-stone-100">
        <div className="text-center space-y-4 max-w-md px-6">
          <h2 className="text-xl font-semibold">เกิดข้อผิดพลาด</h2>
          <p className="text-sm text-stone-500">{error?.message || 'Unknown error'}</p>
          <button
            onClick={reset}
            className="rounded-xl bg-amber-400/15 border border-amber-300/20 px-4 py-2 text-sm text-amber-300 hover:bg-amber-400/25 transition-colors"
          >
            ลองใหม่
          </button>
        </div>
      </body>
    </html>
  )
}
