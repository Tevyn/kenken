import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Keypad } from './Keypad'

describe('Keypad', () => {
  it('renders exactly `size` digit buttons', () => {
    render(<Keypad size={6} mode="value" onDigit={vi.fn()} onErase={vi.fn()} onToggleMode={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /^Enter \d$/ })).toHaveLength(6)
  })

  it('clicking a digit calls onDigit with that value', async () => {
    const user = userEvent.setup()
    const onDigit = vi.fn()
    render(<Keypad size={4} mode="value" onDigit={onDigit} onErase={vi.fn()} onToggleMode={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Enter 3' }))
    expect(onDigit).toHaveBeenCalledWith(3)
  })

  it('erase button calls onErase', async () => {
    const user = userEvent.setup()
    const onErase = vi.fn()
    render(<Keypad size={4} mode="value" onDigit={vi.fn()} onErase={onErase} onToggleMode={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Erase' }))
    expect(onErase).toHaveBeenCalledTimes(1)
  })

  it('mode button reflects mark mode and calls onToggleMode', async () => {
    const user = userEvent.setup()
    const onToggleMode = vi.fn()
    const { rerender } = render(
      <Keypad size={4} mode="value" onDigit={vi.fn()} onErase={vi.fn()} onToggleMode={onToggleMode} />,
    )
    const modeButton = screen.getByText('Marks: Off')
    await user.click(modeButton)
    expect(onToggleMode).toHaveBeenCalledTimes(1)

    rerender(<Keypad size={4} mode="mark" onDigit={vi.fn()} onErase={vi.fn()} onToggleMode={onToggleMode} />)
    expect(screen.getByText('Marks: On')).toHaveAttribute('aria-pressed', 'true')
  })
})
