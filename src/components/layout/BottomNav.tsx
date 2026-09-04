import { NavLink } from 'react-router-dom'
import { primaryNav } from './navigation'

/** Mobile tab bar. Sits above the iOS home indicator via safe-area padding. */
export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {primaryNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.matchPrefix !== true}
          className="bottom-nav__link"
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span>{item.shortLabel}</span>
        </NavLink>
      ))}
    </nav>
  )
}
