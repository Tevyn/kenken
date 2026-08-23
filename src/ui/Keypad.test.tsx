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
    hint: {
      open: false,
      onOpenChange: vi.fn(),
      text: null,
      onCorrectness: vi.fn(),
      onTip: vi.fn(),
      onNumber: vi.fn(() => true),
    },
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

  /*
   * The labels are the accessible names, rather than an `aria-label`
   * duplicating a glyph nobody could read. Nothing carries a `title`, so
   * nothing hovers. Hint is the exception on `aria-label` only, because every
   * popover trigger in the app names its panel that way.
   */
  it('each of the five actions pairs a glyph with a visible label', () => {
    const { container } = render(<Keypad {...baseProps()} />)
    const actions = container.querySelectorAll('.kk-keypad__action')
    expect(actions).toHaveLength(5)
    for (const action of actions) {
      expect(action).not.toHaveAttribute('title')
      expect(action.querySelector('svg')).not.toBeNull()
      expect(action.querySelector('.kk-control__label')?.textContent).toBeTruthy()
    }
    expect(
      Array.from(actions, (a) => a.querySelector('.kk-control__label')?.textContent),
    ).toEqual(['Undo', 'Redo', 'Erase', 'Notes', 'Hint'])
  })

  /*
   * State is spelled out rather than tinted: the badge reads OFF or ON at all
   * times, so the control says what it is doing without the player having to
   * know what the default was.
   */
  it('the notes button carries a literal OFF/ON badge matching aria-pressed', () => {
    const { container, rerender } = render(<Keypad {...baseProps()} />)
    const badge = () => container.querySelector('.kk-keypad__badge')

    expect(badge()).toHaveTextContent('OFF')
    expect(badge()?.className).not.toContain('kk-keypad__badge--on')
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    rerender(<Keypad {...baseProps()} mode="mark" />)
    expect(badge()).toHaveTextContent('ON')
    expect(badge()?.className).toContain('kk-keypad__badge--on')
  })

  it('mode button reflects mark mode and calls onToggleMode', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<Keypad {...props} />)

    const modeButton = screen.getByRole('button', { name: 'Notes' })
    expect(modeButton).toHaveAttribute('aria-pressed', 'false')
    await user.click(modeButton)
    expect(props.onToggleMode).toHaveBeenCalledTimes(1)

    rerender(<Keypad {...props} mode="mark" />)
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute(
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

  it('the hint button opens a panel rather than acting, and advertises its shortcut', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<Keypad {...props} />)

    const hint = screen.getByRole('button', { name: 'Hint' })
    expect(hint).toHaveAttribute('aria-keyshortcuts', 'H')
    expect(hint).toHaveAttribute('aria-haspopup', 'dialog')
    expect(hint).toHaveAttribute('aria-expanded', 'false')

    await user.click(hint)
    expect(props.hint.onOpenChange).toHaveBeenCalledWith(true)
    // The keypad owns none of it: nothing opens until the owner says so.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /*
   * The button no longer renames itself, because nothing is ever armed behind
   * it: one press opens the panel, and the panel's own choices act.
   */
  it('the hint button keeps its label whatever the panel is doing', () => {
    const props = baseProps()
    const { rerender } = render(<Keypad {...props} />)
    expect(screen.getByRole('button', { name: 'Hint' })).toBeInTheDocument()

    rerender(<Keypad {...props} hint={{ ...props.hint, open: true, text: 'This cell has to be 2' }} />)
    expect(screen.getByRole('button', { name: 'Hint' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
  })
})
