import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyButton } from './ui/CopyButton'

describe('CopyButton', () => {
  it('copies the given text and confirms it', async () => {
    const user = userEvent.setup()
    // userEvent.setup() installs its own clipboard stub, so replace it after.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    render(<CopyButton text="kubectl get pods" />)

    await user.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    expect(writeText).toHaveBeenCalledWith('kubectl get pods')
    expect(await screen.findByText(/copied/i)).toBeVisible()
  })

  it('reports a failure instead of pretending it worked', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    // The legacy fallback also fails, as it does on a non-secure origin.
    Object.defineProperty(document, 'execCommand', {
      value: () => {
        throw new Error('not supported')
      },
      configurable: true,
    })
    render(<CopyButton text="kubectl get pods" />)
    await user.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    expect(await screen.findByText(/copy failed/i)).toBeVisible()
  })
})
