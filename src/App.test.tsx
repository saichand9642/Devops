import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { STORAGE_KEY, loadState } from './lib/storage'

const renderApp = () => {
  window.history.pushState({}, '', '/')
  return render(<App />)
}

describe('navigation', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders the home page with the app name and the independence disclaimer', () => {
    renderApp()
    expect(screen.getByRole('heading', { level: 1, name: /devops learning hub/i })).toBeVisible()
    expect(screen.getByText(/independent learning tool/i)).toBeVisible()
    expect(screen.getByText(/not affiliated with, endorsed by/i)).toBeVisible()
  })

  it('shows the CKAD course card with its progress at zero', () => {
    renderApp()
    expect(screen.getByText(/Certified Kubernetes Application Developer/i)).toBeVisible()
    expect(screen.getAllByText(/0%/).length).toBeGreaterThan(0)
  })

  it('offers a Continue Learning action and an exam-readiness indicator', () => {
    renderApp()
    expect(screen.getByRole('link', { name: /start learning|continue learning/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /exam readiness/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /daily practice suggestion/i })).toBeVisible()
  })

  it('navigates from home to the CKAD dashboard and shows all five weighted domains', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('link', { name: /^CKAD dashboard$/i }))

    expect(await screen.findByRole('heading', { level: 1, name: /CKAD/i })).toBeVisible()
    for (const [title, weight] of [
      ['Application Design and Build', '20%'],
      ['Application Deployment', '20%'],
      ['Application Observability and Maintenance', '15%'],
      ['Application Environment, Configuration and Security', '25%'],
      ['Services and Networking', '20%'],
    ]) {
      const heading = screen.getByRole('heading', { name: title as string })
      const section = heading.closest('section')
      expect(section, `section for ${title}`).not.toBeNull()
      expect(within(section as HTMLElement).getByText(`${weight} of exam`)).toBeVisible()
    }
  })

  it('navigates into a lesson and renders every required section', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/ckad/topics/probes')
    render(<App />)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /liveness, readiness and startup probes/i,
      }),
    ).toBeVisible()

    for (const section of [
      /what this is, in plain language/i,
      /why you need this/i,
      /how it works/i,
      /important objects and fields/i,
      /real-world example/i,
      /yaml examples/i,
      /imperative commands/i,
      /declarative method/i,
      /verification commands/i,
      /troubleshooting commands/i,
      /common mistakes/i,
      /ckad exam tips/i,
      /summary/i,
      /practice questions/i,
      /hands-on lab/i,
    ]) {
      // Scoped to <main> and tolerant of the word appearing more than once.
      const matches = within(screen.getByRole('main')).getAllByText(section)
      expect(matches.length, String(section)).toBeGreaterThan(0)
    }

    expect(screen.getByRole('button', { name: /mark as completed/i })).toBeVisible()
    await user.click(screen.getByRole('link', { name: /^Search the course$/i }))
    expect(
      await screen.findByRole('heading', { level: 1, name: /search the course/i }),
    ).toBeVisible()
  })

  it('hides practice answers until the learner reveals them', async () => {
    window.history.pushState({}, '', '/ckad/topics/probes')
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: /probes/i })
    // Native <details> keeps the answer in the DOM but collapsed.
    const reveals = screen.getAllByText(/show answer/i)
    expect(reveals.length).toBeGreaterThanOrEqual(3)
    for (const reveal of reveals) {
      expect(reveal.closest('details')?.open).toBe(false)
    }
  })

  it('shows a helpful not-found page for an unknown route', async () => {
    window.history.pushState({}, '', '/ckad/topics/does-not-exist')
    render(<App />)
    expect(
      await screen.findByRole('heading', { level: 1, name: /lesson not found/i }),
    ).toBeVisible()
  })

  it('shows a not-found page for an unknown path', async () => {
    window.history.pushState({}, '', '/nowhere')
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: /page not found/i })).toBeVisible()
  })

  it('exposes primary navigation for mobile and desktop', () => {
    renderApp()
    const navs = screen.getAllByRole('navigation', { name: /primary/i })
    expect(navs.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('link', { name: /^Practice$/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /^Exams$/ }).length).toBeGreaterThan(0)
  })

  it('marks only the current destination as the current page', async () => {
    window.history.pushState({}, '', '/ckad/topics/probes')
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: /probes/i })

    // Sidebar curriculum links point at dashboard sections, so none of them -
    // and not the CKAD course link either - should claim to be the current
    // PAGE here.
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(0)

    // The course switcher does mark which course you are inside, but as a
    // location rather than a page.
    const inCourse = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'location')
      .map((link) => link.textContent)
    expect(inCourse.length).toBeGreaterThan(0)
    expect(inCourse.every((text) => /CKAD/i.test(text ?? ''))).toBe(true)

    // On the dashboard itself, the CKAD course link is current.
    window.history.pushState({}, '', '/ckad')
    render(<App />)
    await screen.findAllByRole('heading', { level: 1, name: /CKAD/i })
    const onDashboard = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent)
    expect(onDashboard.length).toBeGreaterThan(0)
    expect(onDashboard.every((text) => /CKAD|Learn/i.test(text ?? ''))).toBe(true)
  })

  it('has a skip link for keyboard users', () => {
    renderApp()
    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument()
  })
})

describe('progress persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('records a visit to a lesson so Continue Learning has a target', async () => {
    window.history.pushState({}, '', '/ckad/topics/pods')
    const { unmount } = render(<App />)
    await screen.findByRole('heading', { level: 1, name: /pods in depth/i })

    // The visit is written to localStorage by the provider effect.
    await vi.waitFor(() => {
      expect(loadState().lastVisitedTopicId).toBe('pods')
    })
    expect(loadState().topics['pods'].status).toBe('in-progress')
    unmount()
  })

  it('persists a completed lesson across a full remount', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/ckad/topics/pods')
    const first = render(<App />)
    await screen.findByRole('heading', { level: 1, name: /pods in depth/i })

    await user.click(screen.getByRole('button', { name: /^mark as completed$/i }))
    await vi.waitFor(() => {
      expect(loadState().topics['pods'].status).toBe('completed')
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('completed')

    first.unmount()

    // A fresh mount reads the stored record back.
    window.history.pushState({}, '', '/ckad/topics/pods')
    render(<App />)
    expect(
      await screen.findByRole('button', { name: /completed — mark as not done/i }),
    ).toBeVisible()
  })

  it('reflects completion in the dashboard percentage', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/ckad/topics/pods')
    const first = render(<App />)
    await screen.findByRole('heading', { level: 1, name: /pods in depth/i })
    await user.click(screen.getByRole('button', { name: /^mark as completed$/i }))
    await vi.waitFor(() => expect(loadState().topics['pods'].status).toBe('completed'))
    first.unmount()

    window.history.pushState({}, '', '/ckad')
    render(<App />)
    const progress = await screen.findByRole('progressbar', { name: /1 of \d+ lessons complete/i })
    expect(progress).toBeVisible()
  })

  it('toggles a completed lesson back to in progress', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/ckad/topics/pods')
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: /pods in depth/i })

    await user.click(screen.getByRole('button', { name: /^mark as completed$/i }))
    await vi.waitFor(() => expect(loadState().topics['pods'].status).toBe('completed'))

    await user.click(screen.getByRole('button', { name: /completed — mark as not done/i }))
    await vi.waitFor(() => expect(loadState().topics['pods'].status).toBe('in-progress'))
  })
})
