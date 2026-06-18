'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'chunk_reload_at'
const RELOAD_COOLDOWN_MS = 15_000

function isChunkError(error: unknown): boolean {
  if (!error) return false
  const e = error as { name?: string; message?: string }
  return (
    e.name === 'ChunkLoadError' ||
    e.message?.includes('Loading chunk') === true ||
    e.message?.includes('Failed to load chunk') === true
  )
}

function safeReload() {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  if (Date.now() - last > RELOAD_COOLDOWN_MS) {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    window.location.reload()
  }
}

/**
 * Catches ChunkLoadError — stale JS chunks after deploy or Turbopack hot-reload race.
 * Listens to BOTH 'error' (sync) and 'unhandledrejection' (async/Promise) events.
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    // Synchronous JS errors
    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.error)) { e.preventDefault(); safeReload() }
    }

    // Promise rejections (Next.js/Turbopack chunks are async)
    const onUnhandled = (e: PromiseRejectionEvent) => {
      if (isChunkError(e.reason)) { e.preventDefault(); safeReload() }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandled)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  }, [])

  return null
}
