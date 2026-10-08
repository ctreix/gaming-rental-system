'use client'

import { useEffect, useRef } from 'react'

/**
 * Repeatedly calls `fn` every `intervalMs` milliseconds.
 *
 * - The interval is cleared on unmount.
 * - Polling pauses while the document is hidden (`document.hidden`) and
 *   resumes when the tab becomes visible again.
 * - `fn` is kept in a ref, so passing an inline closure does not restart the
 *   interval on every render.
 */
export function usePolling(fn: () => void, intervalMs: number): void {
  const fnRef = useRef(fn)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (interval !== null) return
      interval = setInterval(() => {
        if (!document.hidden) fnRef.current()
      }, intervalMs)
    }

    const stop = () => {
      if (interval === null) return
      clearInterval(interval)
      interval = null
    }

    const handleVisibilityChange = () => {
      if (document.hidden) stop()
      else start()
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [intervalMs])
}
