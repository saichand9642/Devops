import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { createEmptyState, saveState, type ProgressState } from '../lib/storage'
import { LAST_EMAIL_KEY, SESSION_KEY } from '../lib/access'
import {
  BLOCKED_TEST_EMAIL,
  OTHER_TEST_EMAIL,
  TEST_DOMAIN_EMAIL,
  TEST_EMAIL,
  signInForTest,
} from '../test/session'

const goTo = (path = '/') => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

const withCompletedLesson = (topicId: string): ProgressState => {
  const state = createEmptyState(1000)
  state.topics[topicId] = { status: 'completed', completedAt: 2000, lastVisitedAt: 2000 }
  state.lastVisitedTopicId = topicId
  return state
}

describe('the email gate', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('asks for an email address instead of opening the app', () => {
    goTo()

    expect(screen.getByLabelText(/email address/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /continue/i })).toBeVisible()
    // Nothing of the app itself is rendered behind it.
    expect(screen.queryByRole('link', { name: /^CKAD dashboard$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('main')?.className).toContain('gate__card')
  })

  it('gates a deep link just as firmly as the home page', () => {
    goTo('/ckad/topics/probes')

    expect(screen.getByLabelText(/email address/i)).toBeVisible()
    expect(screen.queryByRole('heading', { name: /probes/i })).not.toBeInTheDocument()
  })

  it('refuses an address that is not on the access list, and stays shut', async () => {
    const user = userEvent.setup()
    goTo()

    await user.type(screen.getByLabelText(/email address/i), BLOCKED_TEST_EMAIL)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/not on the access list/i)
    expect(screen.getByLabelText(/email address/i)).toBeVisible()
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('tells the learner a malformed address is a typo, not a refusal', async () => {
    const user = userEvent.setup()
    goTo()

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/does not look like an email/i)
  })

  it('clears the error as soon as the learner starts correcting it', async () => {
    const user = userEvent.setup()
    goTo()

    await user.type(screen.getByLabelText(/email address/i), BLOCKED_TEST_EMAIL)
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByRole('alert')).toBeVisible()

    await user.type(screen.getByLabelText(/email address/i), 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('opens the app for a listed address and remembers it', async () => {
    const user = userEvent.setup()
    goTo()

    await user.type(screen.getByLabelText(/email address/i), TEST_EMAIL)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(
      await screen.findByRole('heading', { level: 1, name: /devops learning hub/i }),
    ).toBeVisible()
    expect(window.localStorage.getItem(SESSION_KEY)).toContain(TEST_EMAIL)
  })

  it('accepts an address typed with stray case and spaces', async () => {
    const user = userEvent.setup()
    goTo()

    await user.type(screen.getByLabelText(/email address/i), `  ${TEST_EMAIL.toUpperCase()} `)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('link', { name: /^CKAD dashboard$/i })).toBeVisible()
  })

  it('admits somebody matched only by a domain rule on the list', async () => {
    const user = userEvent.setup()
    goTo()

    await user.type(screen.getByLabelText(/email address/i), TEST_DOMAIN_EMAIL)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('link', { name: /^CKAD dashboard$/i })).toBeVisible()
  })

  it('does not ask again on the next visit', () => {
    signInForTest()
    goTo()

    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: /devops learning hub/i })).toBeVisible()
  })

  it('locks out a remembered address once it leaves the access list', () => {
    signInForTest('removed.person@example.test')
    goTo()

    expect(screen.getByLabelText(/email address/i)).toBeVisible()
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('offers the last address back so a returning learner just confirms it', async () => {
    const user = userEvent.setup()
    goTo()
    await user.type(screen.getByLabelText(/email address/i), TEST_EMAIL)
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByRole('heading', { level: 1, name: /devops learning hub/i })

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(await screen.findByLabelText(/email address/i)).toHaveValue(TEST_EMAIL)
    expect(window.localStorage.getItem(LAST_EMAIL_KEY)).toBe(TEST_EMAIL)
  })
})

describe('signing out and back in', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows who is signed in and closes the app again on sign out', async () => {
    const user = userEvent.setup()
    signInForTest()
    goTo()

    const signOut = screen.getByRole('button', {
      name: new RegExp(`signed in as ${TEST_EMAIL}`, 'i'),
    })
    await user.click(signOut)

    expect(await screen.findByLabelText(/email address/i)).toBeVisible()
  })

  it('hands back the same progress, not an empty app', async () => {
    const user = userEvent.setup()
    signInForTest()
    saveState(withCompletedLesson('pods'), TEST_EMAIL)
    goTo('/progress')

    const account = (await screen.findByRole('heading', { name: /^signed in$/i })).closest(
      'section',
    ) as HTMLElement
    expect(within(account).getByText(TEST_EMAIL)).toBeVisible()
    expect(within(account).getByRole('link', { name: /pods/i })).toBeVisible()

    await user.click(within(account).getByRole('button', { name: /^sign out$/i }))
    await screen.findByLabelText(/email address/i)

    await user.type(screen.getByLabelText(/email address/i), TEST_EMAIL)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Back on the page they were on, with their record intact.
    const restored = (await screen.findByRole('heading', { name: /^signed in$/i })).closest(
      'section',
    ) as HTMLElement
    expect(within(restored).getByText(/^1 of \d+$/)).toBeVisible()
    expect(within(restored).getByRole('link', { name: /pods/i })).toBeVisible()
  })

  it('does not leak one learner"s progress into another"s session', async () => {
    const user = userEvent.setup()
    saveState(withCompletedLesson('pods'), TEST_EMAIL)
    saveState(withCompletedLesson('probes'), OTHER_TEST_EMAIL)
    signInForTest()
    goTo('/progress')

    const account = (await screen.findByRole('heading', { name: /^signed in$/i })).closest(
      'section',
    ) as HTMLElement
    // The lesson the OTHER learner completed is nowhere in this session.
    expect(within(account).getByRole('link', { name: /pods/i })).toBeVisible()
    expect(within(account).queryByRole('link', { name: /probes/i })).not.toBeInTheDocument()

    await user.click(within(account).getByRole('button', { name: /^sign out$/i }))
    expect(await screen.findByLabelText(/email address/i)).toBeVisible()
  })
})
