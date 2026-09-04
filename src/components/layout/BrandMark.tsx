/** Inline logo so the shell renders instantly and works offline. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="top-bar__brand-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="DevOps Learning Hub logo"
    >
      <rect width="64" height="64" rx="14" fill="#12203c" />
      <g fill="none" stroke="#7dd3fc" strokeWidth="3.4" strokeLinecap="round">
        <circle cx="32" cy="32" r="19" />
        <path d="M32 32V13" />
        <path d="M32 32l18.1 5.9" />
        <path d="M32 32l-11.2 15.4" />
        <path d="M32 32l11.2 15.4" />
        <path d="M32 32L13.9 37.9" />
        <path d="M32 32L17.8 18.9" />
        <path d="M32 32l14.2-13.1" />
      </g>
      <circle cx="32" cy="32" r="6" fill="#7dd3fc" />
    </svg>
  )
}
