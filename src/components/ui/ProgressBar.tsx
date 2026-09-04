interface ProgressBarProps {
  value: number
  label?: string
  showValue?: boolean
  large?: boolean
  tone?: 'primary' | 'success'
}

export function ProgressBar({
  value,
  label,
  showValue = false,
  large = false,
  tone = 'primary',
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="stack-sm">
      {(label || showValue) && (
        <div className="meter-row">
          {label && <span className="muted">{label}</span>}
          {showValue && <span className="meter-row__value">{clamped}%</span>}
        </div>
      )}
      <div
        className={`progress ${large ? 'progress--lg' : ''}`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className={`progress__bar ${tone === 'success' ? 'progress__bar--success' : ''}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
