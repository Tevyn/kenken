import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Mode } from '../game/state'
import { Keypad } from './Keypad'

function baseProps(mode: Mode = 'value') {
  return {
    size: 4,
    mode,
    onDigit: vi.fn(),
    onErase: vi.fn(),
    onToggleMode: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: true,
    canRedo: true,
    onHint: vi.fn(),
  }
}

describe('Keypad', () => {
  it('renders exactly `size` digit buttons', () => {
    render(<Keypad {...baseProps()} size={6} />)
    expect(screen.getAllByRole('button', { name: /^Enter \d$/ })).toHaveLength(6)
  })

  it('clicking a digit calls onDigit with that value', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<Keypad {...props} />)
    await user.click(screen.getByRole('button', { name: 'Enter 3' }))
    expect(props.onDigit).toHaveBeenCalledWith(3)
  })

  it('erase button calls onErase', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<Keypad {...props} />)
    await user.click(screen.getByRole('button', { name: 'Erase' }))
    expect(props.onErase).toHaveBeenCalledTimes(1)
  })

  it('the five actions are icon-only and never carry a tooltip', () => {
    const { container } = render(<Keypad {...baseProps()} />)
    const actions = container.querySelectorAll('.kk-keypad__action')
    expect(actions).toHaveLength(5)
    for (const action of actions) {
      expect(action).toHaveAttribute('aria-label')
      expect(action).not.toHaveAttribute('title')
      expect(action.textContent).toBe('')
      expect(action.querySelector('svg')).not.toBeNull()
    }
  })

  it('mode button reflects mark mode and calls onToggleMode', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<Keypad {...props} />)

    const modeButton = screen.getByRole('button', { name: 'Pencil-mark mode' })
    expect(modeButton).toHaveAttribute('aria-pressed', 'false')
    await user.click(modeButton)
    expect(props.onToggleMode).toHaveBeenCalledTimes(1)

    rerender(<Keypad {...props} mode="mark" />)
    expect(screen.getByRole('button', { name: 'Pencil-mark mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('undo and redo are disabled when unavailable', () => {
    render(<Keypad {...baseProps()} canUndo={false} canRedo />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled()
  })

  it('undo and redo call their callbacks', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<Keypad {...props} />)
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(props.onUndo).toHaveBeenCalledTimes(1)
    expect(props.onRedo).toHaveBeenCalledTimes(1)
  })

  it('hint button calls onHint and advertises its shortcut', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<Keypad {...props} />)
    const hint = screen.getByRole('button', { name: 'Hint' })
    expect(hint).toHaveAttribute('aria-keyshortcuts', 'H')
    await user.click(hint)
    expect(props.onHint).toHaveBeenCalledTimes(1)
  })

  it('the hint button reads "Apply hint" and looks armed once a hint is waiting', () => {
    render(<Keypad {...baseProps()} hintPending />)
    const hint = screen.getByRole('button', { name: 'Apply hint' })
    expect(hint).toHaveAttribute('aria-keyshortcuts', 'H')
    expect(hint.className).toContain('kk-keypad__action--armed')
    expect(screen.queryByRole('button', { name: 'Hint' })).not.toBeInTheDocument()
  })
})
