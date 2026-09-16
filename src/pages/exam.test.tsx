import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { loadState } from '../lib/storage'
import { buildExam } from '../lib/exam-builder'
import { ckadCourse } from '../content/courses'
import { signInForTest } from '../test/session'

const goTo = (path: string) => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('mock exam configuration', () => {
  beforeEach(() => {
    window.localStorage.clear()
    signInForTest()
  })

  it('states clearly that the questions are original practice questions', async () => {
    goTo('/ckad/exams')
    expect(await screen.findByRole('heading', { level: 1, name: /mock exams/i })).toBeVisible()
    expect(
      screen.getByText(/These are original practice questions, not actual exam questions/i),
    ).toBeVisible()
  })

  it('offers a realistic default and configurable presets', async () => {
    goTo('/ckad/exams')
    await screen.findByRole('heading', { level: 1, name: /mock exams/i })

    expect(screen.getByLabelText(/timer \(minutes\)/i)).toHaveValue(120)
    expect(screen.getByLabelText(/^questions$/i)).toHaveValue(20)
    expect(screen.getByRole('button', { name: /quick sprint/i })).toBeVisible()
    // The pass mark is interpolated into a sentence, so assert on the region text.
    expect(screen.getByRole('main').textContent).toMatch(/66%/)
  })

  it('shows the official weighting used to build the paper', async () => {
    goTo('/ckad/exams')
    await screen.findByRole('heading', { level: 1, name: /mock exams/i })
    const table = screen.getByRole('table')
    expect(within(table).getByText('25%')).toBeVisible()
    expect(within(table).getByText('15%')).toBeVisible()
  })

  it('applies a preset to the timer and question count', async () => {
    const user = userEvent.setup()
    goTo('/ckad/exams')
    await screen.findByRole('heading', { level: 1, name: /mock exams/i })

    await user.click(screen.getByRole('button', { name: /quick sprint/i }))
    expect(screen.getByLabelText(/timer \(minutes\)/i)).toHaveValue(20)
    expect(screen.getByLabelText(/^questions$/i)).toHaveValue(5)
  })

  it('reports an empty attempt history before any attempt', async () => {
    goTo('/ckad/exams')
    expect(await screen.findByText(/no attempts yet/i)).toBeVisible()
  })
})

describe('mock exam scoring', () => {
  beforeEach(() => {
    window.localStorage.clear()
    signInForTest()
  })

  it('hides all correctness while the exam is running', async () => {
    goTo('/ckad/exams/run?minutes=20&count=5&seed=42')
    expect(
      await screen.findByRole('heading', { level: 1, name: /mock exam in progress/i }),
    ).toBeVisible()
    expect(screen.getByText(/answers stay hidden until you submit/i)).toBeVisible()
    expect(screen.queryByText(/^✓ Correct$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^✗ Incorrect$/)).not.toBeInTheDocument()
    // No explanation is rendered before submission.
    expect(screen.queryByText('💡')).not.toBeInTheDocument()
  })

  it('shows a countdown timer and progress counter', async () => {
    goTo('/ckad/exams/run?minutes=20&count=5&seed=42')
    await screen.findByRole('heading', { level: 1, name: /mock exam in progress/i })
    expect(screen.getByRole('timer')).toBeVisible()
    expect(screen.getByText('0/5 answered')).toBeVisible()
  })

  it('scores a submitted paper, saves it and breaks it down by domain', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const paper = buildExam(ckadCourse, 5, 4242)
    goTo('/ckad/exams/run?minutes=20&count=5&seed=4242')
    await screen.findByRole('heading', { level: 1, name: /mock exam in progress/i })

    // Answer the first question correctly if it is a choice question.
    const first = paper.questions[0]
    if (first.kind === 'mcq') {
      const option = first.options.find((candidate) => candidate.id === first.correct[0])!
      await user.click(screen.getByLabelText(option.text))
    }

    await user.click(screen.getAllByRole('button', { name: /submit exam/i })[0])

    // Lands on the review page.
    expect(await screen.findByRole('heading', { name: /score by domain/i })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: /^overall$/i })).toBeVisible()

    const stored = loadState().exams
    expect(stored).toHaveLength(1)
    expect(stored[0].courseId).toBe('ckad')
    expect(stored[0].minutesAllowed).toBe(20)
    expect(stored[0].passingScore).toBe(66)
    expect(stored[0].answers).toHaveLength(5)
    expect(Object.keys(stored[0].byDomain).length).toBeGreaterThan(0)

    confirmSpy.mockRestore()
  })

  it('reveals explanations only after submission', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    goTo('/ckad/exams/run?minutes=20&count=5&seed=7')
    await screen.findByRole('heading', { level: 1, name: /mock exam in progress/i })
    await user.click(screen.getAllByRole('button', { name: /submit exam/i })[0])

    await screen.findByRole('heading', { name: /answers and explanations/i })
    // At least one explanation block is now rendered.
    expect(screen.getAllByText('💡').length).toBeGreaterThan(0)

    confirmSpy.mockRestore()
  })

  it('lets a performance-based task be self-verified after submission, changing the score', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    // Find a seed whose paper includes at least one task question.
    let seed = 1
    let paper = buildExam(ckadCourse, 20, seed)
    while (!paper.questions.some((question) => question.kind === 'task') && seed < 40) {
      seed += 1
      paper = buildExam(ckadCourse, 20, seed)
    }
    const task = paper.questions.find((question) => question.kind === 'task')
    expect(task, 'expected a task question in the generated paper').toBeDefined()
    if (!task || task.kind !== 'task') return

    goTo(`/ckad/exams/run?minutes=30&count=20&seed=${seed}`)
    await screen.findByRole('heading', { level: 1, name: /mock exam in progress/i })
    await user.click(screen.getAllByRole('button', { name: /submit exam/i })[0])

    await screen.findByRole('heading', { name: /answers and explanations/i })

    const before = loadState().exams[0].earnedPoints
    expect(screen.getAllByText(/performance-based task/i).length).toBeGreaterThan(0)

    // Confirm one checkpoint on the task, which awards partial credit.
    const checkbox = screen.getByLabelText(task.checkpoints[0].text)
    await user.click(checkbox)

    await vi.waitFor(() => {
      expect(loadState().exams[0].earnedPoints).toBeGreaterThan(before)
    })

    confirmSpy.mockRestore()
  })

  it('filters the review to questions that did not get full marks', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    goTo('/ckad/exams/run?minutes=20&count=5&seed=99')
    await screen.findByRole('heading', { level: 1, name: /mock exam in progress/i })
    await user.click(screen.getAllByRole('button', { name: /submit exam/i })[0])
    await screen.findByRole('heading', { name: /answers and explanations/i })

    // Everything was unanswered, so all five are below full marks.
    const filter = screen.getByRole('button', { name: /not full marks \(5\)/i })
    await user.click(filter)
    expect(filter).toHaveAttribute('aria-pressed', 'true')
  })

  it('lists a saved attempt in the history and links to its review', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    goTo('/ckad/exams/run?minutes=20&count=5&seed=1234')
    await screen.findByRole('heading', { level: 1, name: /mock exam in progress/i })
    await user.click(screen.getAllByRole('button', { name: /submit exam/i })[0])
    await screen.findByRole('heading', { name: /score by domain/i })

    window.history.pushState({}, '', '/ckad/exams')
    render(<App />)

    expect(await screen.findByRole('heading', { name: /attempt history/i })).toBeVisible()
    expect(screen.getAllByRole('link', { name: /^review$/i }).length).toBeGreaterThan(0)

    confirmSpy.mockRestore()
  })

  it('shows a clear message when an attempt id is unknown', async () => {
    goTo('/ckad/exams/attempts/nope')
    expect(await screen.findByText(/attempt not found/i)).toBeVisible()
  })
})
