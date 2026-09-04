import type { UpdateStatus } from '../lib/sw-update'

interface UpdateToastProps {
  status: UpdateStatus
  onUpdate: () => void
  onDismiss: () => void
}

/**
 * Presentational half of the update prompt, so the wording and behaviour can
 * be tested without a real service worker.
 */
export function UpdateToast({ status, onUpdate, onDismiss }: UpdateToastProps) {
  if (status === 'idle') return null

  if (status === 'offline-ready') {
    return (
      <div className="update-toast" role="status" aria-live="polite">
        <span className="update-toast__text">
          ✓ Ready to work offline — lessons you have opened stay available without a network.
        </span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <div className="update-toast" role="alert" aria-live="assertive">
      <span className="update-toast__text">
        New version available — your saved progress is kept.
      </span>
      <button type="button" className="btn btn--sm" onClick={onUpdate}>
        Update
      </button>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss}>
        Later
      </button>
    </div>
  )
}
