import { useEffect, useState } from 'react'

const format = (totalSeconds: number): string => {
  const safe = Math.max(0, totalSeconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

interface TimerProps {
  /** Wall-clock milliseconds when the exam started. */
  startedAt: number
  minutesAllowed: number
  onExpire: () => void
  paused?: boolean
}

/**
 * Counts down from the allowance, driven by wall-clock time rather than an
 * accumulating interval - so switching tabs, backgrounding the app or a slow
 * device cannot give the learner extra time.
 */
export function Timer({ startedAt, minutesAllowed, onExpire, paused = false }: TimerProps) {
  const totalSeconds = minutesAllowed * 60
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, totalSeconds - Math.floor((Date.now() - startedAt) / 1000)),
  )

  useEffect(() => {
    if (paused) return
    const tick = () => {
      const next = Math.max(0, totalSeconds - Math.floor((Date.now() - startedAt) / 1000))
      setRemaining(next)
      if (next === 0) onExpire()
    }
    tick()
    const handle = window.setInterval(tick, 1000)
    return () => window.clearInterval(handle)
  }, [startedAt, totalSeconds, onExpire, paused])

  const fraction = totalSeconds === 0 ? 0 : remaining / totalSeconds
  const tone = fraction <= 0.05 ? 'timer--critical' : fraction <= 0.2 ? 'timer--warning' : ''

  return (
    <span className={`timer ${tone}`} role="timer" aria-live="off">
      <span className="visually-hidden">Time remaining: </span>
      {format(remaining)}
    </span>
  )
}
