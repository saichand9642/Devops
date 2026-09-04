import type { ReactNode } from 'react'

interface StateBlockProps {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}

/** Shared presentation for empty, error and "nothing matched" states. */
export function EmptyState({ icon = '🗂️', title, description, action }: StateBlockProps) {
  return (
    <div className="state-block">
      <span className="state-block__icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{title}</strong>
      {description && <p style={{ margin: 0 }}>{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ title, description, action }: StateBlockProps) {
  return (
    <div className="state-block" role="alert">
      <span className="state-block__icon" aria-hidden="true">
        ⚠️
      </span>
      <strong>{title}</strong>
      {description && <p style={{ margin: 0 }}>{description}</p>}
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
