import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { loadState } from '../lib/storage'
import { interviewTopics } from '../content/interview'
import { signInForTest } from '../test/session'

const goTo = (path: string) => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

const dockerTopic = interviewTopics.find((topic) => topic.id === 'docker')
if (!dockerTopic) throw new Error('expected a docker interview topic')

/** The first single-answer question in a topic, for deterministic assertions. */
const firstMcq = dockerTopic.questions.find((question) => question.kind === 'mcq')
if (!firstMcq?.options || !firstMcq.correct) throw new Error('expected a docker mcq')
// Pulled out so the narrowing survives into the test callbacks below.
const mcqOptions = firstMcq.options
const mcqCorrect = firstMcq.correct

describe('interview hub', () => {
  beforeEach(() => {
    window.localStorage.clear()
    signInForTest()
  })

  it('lists every topic with a link into it', async () => {
    goTo('/interview')
    await screen.findByRole('heading', { level: 1, name: /devops interview preparation/i })
    const main = within(screen.getByRole('main'))
    for (const topic of interviewTopics) {
      expect(main.getByRole('link', { name: new RegExp(topic.title, 'i') }), topic.id).toBeVisible()
    }
  })

  it('starts at zero recall and counts the whole bank', async () => {
    goTo('/interview')
    await screen.findByRole('heading', { level: 1, name: /devops interview preparation/i })
    const total = interviewTopics.reduce((sum, topic) => sum + topic.questions.length, 0)
    expect(screen.getByText(new RegExp(`0 of ${total} questions`, 'i'))).toBeVisible()
  })

  it('is reachable from the home page alongside the certification courses', async () => {
    goTo('/')
    await screen.findByRole('heading', { level: 1, name: /devops learning hub/i })
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('heading', { name: /certification courses/i })).toBeVisible()
    expect(main.getByRole('heading', { name: /interview preparation/i })).toBeVisible()
    expect(main.getByRole('link', { name: /devops interview questions/i })).toBeVisible()
  })
})

describe('interview question card', () => {
  beforeEach(() => {
    window.localStorage.clear()
    signInForTest()
  })

  it('hides the answer until it is asked for', async () => {
    goTo('/interview/docker')
    await screen.findByRole('heading', { level: 1, name: new RegExp(dockerTopic.title, 'i') })

    // No answer body is on the page before anything is revealed.
    expect(screen.queryByRole('heading', { name: /how to answer/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /show the answer|check my answer/i }).length).toBe(
      dockerTopic.questions.length,
    )
  })

  it('makes you commit to an option before it will grade a choice question', async () => {
    const user = userEvent.setup()
    goTo('/interview/docker')
    await screen.findByRole('heading', { level: 1, name: new RegExp(dockerTopic.title, 'i') })

    const card = screen.getByText(firstMcq.prompt).closest('article')
    if (!card) throw new Error('expected the question to render in a card')
    const scoped = within(card as HTMLElement)

    const check = scoped.getByRole('button', { name: /check my answer/i })
    expect(check).toBeDisabled()
    expect(scoped.getByText(/pick an option first/i)).toBeVisible()

    const correctText = mcqOptions.find((option) => option.id === mcqCorrect[0])?.text
    if (!correctText) throw new Error('expected the correct option to have text')
    await user.click(scoped.getByRole('button', { name: new RegExp(escape(correctText), 'i') }))
    expect(check).toBeEnabled()

    await user.click(check)
    expect(scoped.getByText(/✓ Correct\./)).toBeVisible()
    expect(scoped.getByRole('heading', { name: /how to answer/i })).toBeVisible()
  })

  it('marks a wrong choice wrong and still explains the answer', async () => {
    const user = userEvent.setup()
    goTo('/interview/docker')
    await screen.findByRole('heading', { level: 1, name: new RegExp(dockerTopic.title, 'i') })

    const card = screen.getByText(firstMcq.prompt).closest('article')
    const scoped = within(card as HTMLElement)

    const wrong = mcqOptions.find((option) => !mcqCorrect.includes(option.id))
    if (!wrong) throw new Error('expected a distractor')
    await user.click(scoped.getByRole('button', { name: new RegExp(escape(wrong.text), 'i') }))
    await user.click(scoped.getByRole('button', { name: /check my answer/i }))

    expect(scoped.getByText(/✗ Not quite\./)).toBeVisible()
    expect(scoped.getByRole('heading', { name: /how to answer/i })).toBeVisible()
  })

  it('reveals an open question without grading it', async () => {
    const user = userEvent.setup()
    goTo('/interview/docker')
    await screen.findByRole('heading', { level: 1, name: new RegExp(dockerTopic.title, 'i') })

    const open = dockerTopic.questions.find((question) => question.kind === 'open')
    if (!open) throw new Error('expected an open docker question')
    const card = screen.getByText(open.prompt).closest('article')
    const scoped = within(card as HTMLElement)

    await user.click(scoped.getByRole('button', { name: /show the answer/i }))
    expect(scoped.getByRole('heading', { name: /how to answer/i })).toBeVisible()
    // Nothing was scored, because an out-loud answer cannot be auto-marked.
    expect(scoped.queryByText(/✓ Correct\.|✗ Not quite\./)).not.toBeInTheDocument()
  })
})

describe('interview recall tracking', () => {
  beforeEach(() => {
    window.localStorage.clear()
    signInForTest()
  })

  it('persists "I know this" and lets the same click undo it', async () => {
    const user = userEvent.setup()
    goTo('/interview/docker')
    await screen.findByRole('heading', { level: 1, name: new RegExp(dockerTopic.title, 'i') })

    const first = dockerTopic.questions[0]
    const card = screen.getByText(first.prompt).closest('article')
    const scoped = within(card as HTMLElement)

    const known = scoped.getByRole('button', { name: /i know this/i })
    expect(known).toHaveAttribute('aria-pressed', 'false')

    await user.click(known)
    expect(known).toHaveAttribute('aria-pressed', 'true')
    expect(loadState().interview[first.id]?.status).toBe('known')

    await user.click(known)
    expect(known).toHaveAttribute('aria-pressed', 'false')
    expect(loadState().interview[first.id]).toBeUndefined()
  })

  it('moves a flagged question into the cross-topic revision queue', async () => {
    const user = userEvent.setup()
    goTo('/interview/docker')
    await screen.findByRole('heading', { level: 1, name: new RegExp(dockerTopic.title, 'i') })

    const first = dockerTopic.questions[0]
    const card = screen.getByText(first.prompt).closest('article')
    await user.click(within(card as HTMLElement).getByRole('button', { name: /needs review/i }))
    expect(loadState().interview[first.id]?.status).toBe('review')

    // The queue is a separate route, and it pulls from every topic.
    window.history.pushState({}, '', '/interview/review')
    render(<App />)
    const heading = await screen.findAllByRole('heading', { level: 1, name: /revision queue/i })
    expect(heading.length).toBeGreaterThan(0)
    expect(screen.getAllByText(first.prompt).length).toBeGreaterThan(0)
  })

  it('shows an empty revision queue when nothing is flagged', async () => {
    goTo('/interview/review')
    await screen.findByRole('heading', { level: 1, name: /revision queue/i })
    expect(screen.getByText(/nothing flagged for review/i)).toBeVisible()
    expect(screen.getByRole('link', { name: /browse topics/i })).toBeVisible()
  })

  it('switching one question to known removes it from the queue count', async () => {
    const user = userEvent.setup()
    goTo('/interview/docker')
    await screen.findByRole('heading', { level: 1, name: new RegExp(dockerTopic.title, 'i') })

    const first = dockerTopic.questions[0]
    const scoped = within(screen.getByText(first.prompt).closest('article') as HTMLElement)
    await user.click(scoped.getByRole('button', { name: /needs review/i }))
    expect(loadState().interview[first.id]?.status).toBe('review')

    await user.click(scoped.getByRole('button', { name: /i know this/i }))
    expect(loadState().interview[first.id]?.status).toBe('known')
    expect(scoped.getByRole('button', { name: /needs review/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

describe('interview routing', () => {
  beforeEach(() => {
    window.localStorage.clear()
    signInForTest()
  })

  it('ranks /interview/review above the dynamic topic route', async () => {
    goTo('/interview/review')
    // If :topicId won, this would render a "topic not found" state instead.
    expect(await screen.findByRole('heading', { level: 1, name: /revision queue/i })).toBeVisible()
  })

  it('handles an unknown topic id without crashing', async () => {
    goTo('/interview/not-a-real-topic')
    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
  })

  it('opens every topic route', async () => {
    for (const topic of interviewTopics) {
      window.history.pushState({}, '', `/interview/${topic.id}`)
      const view = render(<App />)
      expect(
        await screen.findByRole('heading', { level: 1, name: new RegExp(topic.title, 'i') }),
        topic.id,
      ).toBeVisible()
      view.unmount()
    }
  })
})

/** Option text is authored content, so it may contain regex metacharacters. */
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/`/g, '')
}
