import type { ReactNode } from 'react'

interface CollapsibleProps {
  id?: string
  title: string
  icon?: string
  count?: string
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * Lesson sections use native <details> so they are keyboard accessible, work
 * with in-page find, and stay open when printed - no JS state required.
 */
export function Collapsible({
  id,
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: CollapsibleProps) {
  return (
    <details className="lesson-section" id={id} open={defaultOpen}>
      <summary className="lesson-section__summary">
        <span className="lesson-section__chevron" aria-hidden="true">
          ▸
        </span>
        {icon && <span aria-hidden="true">{icon}</span>}
        <span className="lesson-section__label">{title}</span>
        {count && <span className="lesson-section__count">{count}</span>}
      </summary>
      <div className="lesson-section__body">{children}</div>
    </details>
  )
}

/** Small inline disclosure used for hidden answers and lab solutions. */
export function Reveal({
  label,
  children,
  tone = 'answer',
}: {
  label: string
  children: ReactNode
  tone?: 'answer' | 'solution'
}) {
  return (
    <details className="reveal">
      <summary className="reveal__summary">
        <span aria-hidden="true">{tone === 'solution' ? '🔧' : '🔍'}</span>
        {label}
      </summary>
      <div className="reveal__body">{children}</div>
    </details>
  )
}
