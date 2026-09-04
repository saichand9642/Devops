import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Copies text to the clipboard with a visible confirmation.
 *
 * iOS Safari only exposes navigator.clipboard on secure origins, so there is a
 * hidden-textarea fallback for http:// dev hosts and older browsers.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

export function CopyButton({ text, label = 'Copy', className }: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onClick = useCallback(async () => {
    const ok = await copyText(text)
    setStatus(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus('idle'), 2000)
  }, [text])

  return (
    <button
      type="button"
      className={`btn btn--ghost btn--sm copy-button ${className ?? ''}`}
      onClick={onClick}
      aria-label={status === 'copied' ? 'Copied to clipboard' : `${label} to clipboard`}
    >
      {status === 'copied' ? '✓ Copied' : status === 'failed' ? 'Copy failed' : `⧉ ${label}`}
    </button>
  )
}
