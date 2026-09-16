import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { signInForTest } from '../test/session'

const goTo = (path: string) => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('search page', () => {
  beforeEach(() => {
    window.localStorage.clear()
    signInForTest()
  })

  it('finds a lesson by typing a term', async () => {
    const user = userEvent.setup()
    goTo('/ckad/search')
    await screen.findByRole('heading', { level: 1, name: /search the course/i })

    await user.type(screen.getByLabelText(/^search$/i), 'networkpolicy')

    const results = await screen.findByRole('list', { name: '' }).catch(() => null)
    void results
    const main = within(screen.getByRole('main'))
    expect(await main.findByText(/^NetworkPolicies$/)).toBeVisible()
  })

  it('finds a reference command', async () => {
    const user = userEvent.setup()
    goTo('/ckad/search')
    await screen.findByRole('heading', { level: 1, name: /search the course/i })

    await user.type(screen.getByLabelText(/^search$/i), 'get endpoints')
    const main = within(screen.getByRole('main'))
    expect((await main.findAllByText(/kubectl get endpoints/)).length).toBeGreaterThan(0)
  })

  it('shows an empty state for a term that does not appear', async () => {
    const user = userEvent.setup()
    goTo('/ckad/search')
    await screen.findByRole('heading', { level: 1, name: /search the course/i })

    await user.type(screen.getByLabelText(/^search$/i), 'zzqqxxnotaterm')
    expect(await screen.findByText(/nothing matched/i)).toBeVisible()
  })

  it('reads an initial query from the URL', async () => {
    goTo('/ckad/search?q=ingress')
    await screen.findByRole('heading', { level: 1, name: /search the course/i })
    expect(screen.getByLabelText(/^search$/i)).toHaveValue('ingress')
    const main = within(screen.getByRole('main'))
    expect(await main.findByText(/results?$/i)).toBeTruthy()
  })

  it('filters by curriculum domain', async () => {
    const user = userEvent.setup()
    goTo('/ckad/search?q=service')
    await screen.findByRole('heading', { level: 1, name: /search the course/i })

    await user.selectOptions(screen.getByLabelText(/curriculum domain/i), 'services-networking')
    expect(await screen.findByText(/1 filter active/i)).toBeVisible()
  })

  it('filters by difficulty and by result type', async () => {
    const user = userEvent.setup()
    goTo('/ckad/search?q=pod')
    await screen.findByRole('heading', { level: 1, name: /search the course/i })

    await user.selectOptions(screen.getByLabelText(/difficulty/i), 'beginner')
    await user.click(screen.getByRole('button', { name: /^Lessons$/ }))

    expect(await screen.findByText(/2 filters active/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /^Lessons$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('clears filters but keeps the query', async () => {
    const user = userEvent.setup()
    goTo('/ckad/search?q=pod&domain=design-build')
    await screen.findByRole('heading', { level: 1, name: /search the course/i })

    await user.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(screen.getByLabelText(/^search$/i)).toHaveValue('pod')
    expect(screen.queryByText(/filter active/i)).not.toBeInTheDocument()
  })

  it('links a result to its destination page', async () => {
    const user = userEvent.setup()
    goTo('/ckad/search')
    await screen.findByRole('heading', { level: 1, name: /search the course/i })
    await user.type(screen.getByLabelText(/^search$/i), 'cronjob')

    const main = within(screen.getByRole('main'))
    const link = (await main.findAllByRole('link'))
      .filter((candidate) => candidate.getAttribute('href')?.includes('/ckad/'))
      .at(0)
    expect(link).toBeDefined()
  })
})

describe('command reference page', () => {
  it('lists command groups and supports search', async () => {
    const user = userEvent.setup()
    goTo('/ckad/commands')
    await screen.findByRole('heading', { level: 1, name: /command reference/i })

    expect(screen.getByText(/Showing \d+ of \d+ commands/i)).toBeVisible()

    await user.type(screen.getByLabelText(/search commands/i), 'rollout')
    const main = within(screen.getByRole('main'))
    expect(await main.findByText(/kubectl rollout status/)).toBeVisible()
  })

  it('narrows to one section', async () => {
    const user = userEvent.setup()
    goTo('/ckad/commands')
    await screen.findByRole('heading', { level: 1, name: /command reference/i })

    await user.click(screen.getByRole('button', { name: /RBAC and ServiceAccounts/i }))
    expect(screen.getByRole('button', { name: /RBAC and ServiceAccounts/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const main = within(screen.getByRole('main'))
    expect(await main.findByText(/kubectl auth can-i --list/)).toBeVisible()
  })

  it('shows an empty state and lets the search be cleared', async () => {
    const user = userEvent.setup()
    goTo('/ckad/commands')
    await screen.findByRole('heading', { level: 1, name: /command reference/i })

    await user.type(screen.getByLabelText(/search commands/i), 'zzqqnotacommand')
    expect(await screen.findByText(/no commands matched/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /clear search/i }))
    expect(screen.getByLabelText(/search commands/i)).toHaveValue('')
  })

  it('offers copy buttons on commands', async () => {
    goTo('/ckad/commands')
    await screen.findByRole('heading', { level: 1, name: /command reference/i })
    expect(screen.getAllByRole('button', { name: /copy to clipboard/i }).length).toBeGreaterThan(10)
  })
})
