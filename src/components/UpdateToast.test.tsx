import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateToast } from './UpdateToast'

describe('UpdateToast: PWA update behaviour', () => {
  it('renders nothing when there is no news', () => {
    const { container } = render(
      <UpdateToast status="idle" onUpdate={() => {}} onDismiss={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('offers an explicit Update action when a new version is available', () => {
    render(<UpdateToast status="update-available" onUpdate={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText(/new version available/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /^update$/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /later/i })).toBeVisible()
  })

  it('reassures the learner that progress is kept across an update', () => {
    render(<UpdateToast status="update-available" onUpdate={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText(/your saved progress is kept/i)).toBeVisible()
  })

  it('announces an available update assertively so it is not missed', () => {
    render(<UpdateToast status="update-available" onUpdate={() => {}} onDismiss={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
  })

  it('applies the update when Update is pressed', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<UpdateToast status="update-available" onUpdate={onUpdate} onDismiss={() => {}} />)
    await user.click(screen.getByRole('button', { name: /^update$/i }))
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it('does not apply the update when Later is pressed', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const onDismiss = vi.fn()
    render(<UpdateToast status="update-available" onUpdate={onUpdate} onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: /later/i }))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shows a polite, dismissible offline-ready confirmation with no Update button', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<UpdateToast status="offline-ready" onUpdate={() => {}} onDismiss={onDismiss} />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText(/ready to work offline/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /^update$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
