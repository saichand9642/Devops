import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/**
 * Sidebar on desktop, tab bar on mobile, with a single scrolling main region.
 *
 * Route changes reset scroll to the top unless the URL carries a hash, so
 * in-page anchors (for example a lesson's "key objects" section) still work.
 */
export function AppShell() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      if (target) {
        target.scrollIntoView({ block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0 })
  }, [pathname, hash])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar />
      <div style={{ minWidth: 0 }}>
        <TopBar />
        <main className="app-main" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
