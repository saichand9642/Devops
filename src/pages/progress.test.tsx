import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { createEmptyState, loadState, saveState, toExportEnvelope } from '../lib/storage'

const goTo = (path: string) => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

/** Builds a File the file input can accept, as the browser would. */
const jsonFile = (name: string, contents: unknown) =>
  new File([JSON.stringify(contents)], name, { type: 'application/json' })

describe('progress export and import', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('explains that progress is local to this browser and this device', async () => {
    goTo('/progress')
    expect(await screen.findByRole('heading', { level: 1, name: /progress & data/i })).toBeVisible()
    expect(screen.getByText(/stored in this browser on this device only/i)).toBeVisible()
    expect(screen.getByText(/starts fresh/i)).toBeVisible()
  })

  it('tells an iPhone user in a Safari tab to install, because iOS clears storage', async () => {
    // A browser tab on iOS - where the seven-day eviction actually applies.
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true })

    goTo('/progress')
    expect(await screen.findByRole('heading', { level: 1, name: /progress & data/i })).toBeVisible()
    expect(screen.getByText(/add this to your home screen/i)).toBeVisible()
    expect(screen.getByText(/seven days/i)).toBeVisible()
  })

  it('does not show the install warning on a desktop browser', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 0, configurable: true })

    goTo('/progress')
    expect(await screen.findByRole('heading', { level: 1, name: /progress & data/i })).toBeVisible()
    expect(screen.queryByText(/add this to your home screen/i)).not.toBeInTheDocument()
  })

  it('exports progress as a downloadable JSON file', async () => {
    const state = createEmptyState()
    state.topics['pods'] = { status: 'completed' }
    saveState(state)

    const createObjectURL = vi.fn().mockReturnValue('blob:mock')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const user = userEvent.setup()
    goTo('/progress')
    await screen.findByRole('heading', { level: 1, name: /progress & data/i })

    await user.click(screen.getByRole('button', { name: /export progress as json/i }))

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    expect(await screen.findByText(/progress exported/i)).toBeVisible()

    clickSpy.mockRestore()
  })

  it('merges an imported file into existing progress, keeping the better result', async () => {
    const existing = createEmptyState()
    existing.topics['pods'] = { status: 'completed' }
    saveState(existing)

    const incoming = createEmptyState()
    incoming.topics['pods'] = { status: 'in-progress' }
    incoming.topics['secrets'] = { status: 'completed' }

    const user = userEvent.setup()
    goTo('/progress')
    await screen.findByRole('heading', { level: 1, name: /progress & data/i })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, jsonFile('progress.json', toExportEnvelope(incoming)))

    expect(await screen.findByText(/file read successfully/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /merge into my progress/i }))

    await vi.waitFor(() => {
      expect(loadState().topics['secrets']?.status).toBe('completed')
    })
    // The already-completed lesson is not demoted by the import.
    expect(loadState().topics['pods'].status).toBe('completed')
    expect(await screen.findByText(/merged into your existing records/i)).toBeVisible()
  })

  it('replaces progress only after an explicit confirmation', async () => {
    const existing = createEmptyState()
    existing.topics['pods'] = { status: 'completed' }
    saveState(existing)

    const incoming = createEmptyState()
    incoming.topics['secrets'] = { status: 'completed' }

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    goTo('/progress')
    await screen.findByRole('heading', { level: 1, name: /progress & data/i })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, jsonFile('progress.json', toExportEnvelope(incoming)))
    await screen.findByText(/file read successfully/i)
    await user.click(screen.getByRole('button', { name: /replace my progress/i }))

    expect(confirmSpy).toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(loadState().topics['pods']).toBeUndefined()
    })
    expect(loadState().topics['secrets'].status).toBe('completed')
    confirmSpy.mockRestore()
  })

  it('does not replace progress if the confirmation is declined', async () => {
    const existing = createEmptyState()
    existing.topics['pods'] = { status: 'completed' }
    saveState(existing)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    goTo('/progress')
    await screen.findByRole('heading', { level: 1, name: /progress & data/i })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, jsonFile('progress.json', toExportEnvelope(createEmptyState())))
    await screen.findByText(/file read successfully/i)
    await user.click(screen.getByRole('button', { name: /replace my progress/i }))

    expect(loadState().topics['pods'].status).toBe('completed')
    confirmSpy.mockRestore()
  })

  it('rejects a file that is not a progress export, with a readable message', async () => {
    const user = userEvent.setup()
    goTo('/progress')
    await screen.findByRole('heading', { level: 1, name: /progress & data/i })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, jsonFile('random.json', { hello: 'world' }))

    expect(
      await screen.findByText(/does not look like a devops learning hub export/i),
    ).toBeVisible()
  })
})

describe('progress reset', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('requires two confirmations and then clears progress but keeps the theme', async () => {
    const state = createEmptyState()
    state.theme = 'dark'
    state.topics['pods'] = { status: 'completed' }
    saveState(state)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    goTo('/progress')
    await screen.findByRole('heading', { level: 1, name: /progress & data/i })

    await user.click(screen.getByRole('button', { name: /reset all progress/i }))

    expect(confirmSpy).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => {
      expect(loadState().topics['pods']).toBeUndefined()
    })
    expect(loadState().theme).toBe('dark')
    confirmSpy.mockRestore()
  })

  it('does nothing if the first confirmation is declined', async () => {
    const state = createEmptyState()
    state.topics['pods'] = { status: 'completed' }
    saveState(state)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    goTo('/progress')
    await screen.findByRole('heading', { level: 1, name: /progress & data/i })

    await user.click(screen.getByRole('button', { name: /reset all progress/i }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(loadState().topics['pods'].status).toBe('completed')
    confirmSpy.mockRestore()
  })

  it('explains that an app update never removes progress', async () => {
    goTo('/progress')
    await screen.findByRole('heading', { level: 1, name: /progress & data/i })
    expect(screen.getByText(/never touches your progress/i)).toBeVisible()
  })

  it('lets the learner switch theme, and stores the choice', async () => {
    const user = userEvent.setup()
    goTo('/progress')
    await screen.findByRole('heading', { level: 1, name: /progress & data/i })

    await user.click(screen.getByRole('button', { name: /^dark$/i }))
    await vi.waitFor(() => expect(loadState().theme).toBe('dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
