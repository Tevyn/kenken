import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Controls } from './Controls'
import type { ControlsProps, OpenMenu } from './Controls'

/**
 * `Controls` is controlled by the app (which needs to know when a popover has
 * the keyboard), so the tests supply the state it no longer owns.
 */
function ControlsHarness(props: Omit<ControlsProps, 'openMenu' | 'onOpenMenuChange'>) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  return <Controls {...props} openMenu={openMenu} onOpenMenuChange={setOpenMenu} />
}

function baseProps() {
  return {
    size: 4,
    difficulty: 'easy' as const,
    onStartGame: vi.fn(),
    autoClearMarks: true,
    onAutoClearMarksChange: vi.fn(),
    theme: 'system' as const,
    onThemeChange: vi.fn(),
  }
}

const newGameButton = () => screen.getByRole('button', { name: 'New game' })
const settingsButton = () => screen.getByRole('button', { name: 'Settings' })

describe('Controls', () => {
  it('shows only the two triggers until one is opened', () => {
    render(<ControlsHarness {...baseProps()} />)
    expect(newGameButton()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(newGameButton()).toHaveAttribute('aria-expanded', 'false')
    expect(settingsButton()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /*
   * `aria-disabled`, not `disabled`: the trigger has to stay focusable so the
   * popover can hand focus back to it in the same commit that disables it.
   */
  it('disabled prop marks the new-game trigger aria-disabled but not settings', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<ControlsHarness {...props} disabled />)

    expect(newGameButton()).toHaveAttribute('aria-disabled', 'true')
    expect(newGameButton()).not.toBeDisabled()
    expect(settingsButton()).toBeEnabled()
    expect(settingsButton()).not.toHaveAttribute('aria-disabled')

    // Still inert: pressing it opens nothing.
    await user.click(newGameButton())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(newGameButton()).toHaveAttribute('aria-expanded', 'false')
  })

  describe('new-game wizard', () => {
    it('opens on size, listing 3x3 .. 9x9 with the current size marked', async () => {
      const user = userEvent.setup()
      render(<ControlsHarness {...baseProps()} />)

      await user.click(newGameButton())
      expect(screen.getByRole('dialog', { name: 'Grid size' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Grid size' })).toBeInTheDocument()

      const sizes = screen.getAllByRole('button', { name: /^\d by \d$/ })
      expect(sizes).toHaveLength(7)
      expect(screen.getByRole('button', { name: '4 by 4' })).toHaveAttribute('aria-current', 'true')
      expect(screen.getByRole('button', { name: '5 by 5' })).not.toHaveAttribute('aria-current')
    })

    it('picking a size advances to difficulty, with the current difficulty marked', async () => {
      const user = userEvent.setup()
      const props = baseProps()
      render(<ControlsHarness {...props} />)

      await user.click(newGameButton())
      await user.click(screen.getByRole('button', { name: '6 by 6' }))

      expect(screen.queryByRole('button', { name: '6 by 6' })).not.toBeInTheDocument()
      // The heading carries the size just committed — there is no way back to check.
      expect(screen.getByRole('dialog', { name: /6 by 6.*Difficulty/ })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /6 by 6.*Difficulty/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Easy' })).toHaveAttribute('aria-current', 'true')
      expect(screen.getByRole('button', { name: 'Hard' })).not.toHaveAttribute('aria-current')
      // Step one commits nothing on its own.
      expect(props.onStartGame).not.toHaveBeenCalled()
    })

    it('picking a difficulty starts the game with both chosen values and closes', async () => {
      const user = userEvent.setup()
      const props = baseProps()
      render(<ControlsHarness {...props} />)

      await user.click(newGameButton())
      await user.click(screen.getByRole('button', { name: '7 by 7' }))
      await user.click(screen.getByRole('button', { name: 'Expert' }))

      expect(props.onStartGame).toHaveBeenCalledTimes(1)
      expect(props.onStartGame).toHaveBeenCalledWith(7, 'expert')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('dismissing with Escape starts nothing', async () => {
      const user = userEvent.setup()
      const props = baseProps()
      render(<ControlsHarness {...props} />)

      await user.click(newGameButton())
      await user.click(screen.getByRole('button', { name: '5 by 5' }))
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(props.onStartGame).not.toHaveBeenCalled()
    })

    it('reopening restarts at step one', async () => {
      const user = userEvent.setup()
      render(<ControlsHarness {...baseProps()} />)

      await user.click(newGameButton())
      await user.click(screen.getByRole('button', { name: '5 by 5' }))
      await user.keyboard('{Escape}')
      await user.click(newGameButton())

      expect(screen.getByRole('dialog', { name: 'Grid size' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '5 by 5' })).toBeInTheDocument()
    })
  })

  describe('settings', () => {
    it('the auto-clear-marks switch reflects the preference', async () => {
      const user = userEvent.setup()
      render(<ControlsHarness {...baseProps()} autoClearMarks={false} />)

      await user.click(settingsButton())
      const toggle = screen.getByRole('switch', { name: 'Auto-clear notes' })
      expect(toggle).not.toBeChecked()
      expect(toggle).toHaveAccessibleDescription(
        'Erase notes that a newly entered digit rules out in that row and column',
      )
    })

    it('flipping the switch calls onAutoClearMarksChange with the negated value', async () => {
      const user = userEvent.setup()
      const props = baseProps()
      render(<ControlsHarness {...props} autoClearMarks />)

      await user.click(settingsButton())
      const toggle = screen.getByRole('switch', { name: 'Auto-clear notes' })
      expect(toggle).toBeChecked()

      await user.click(toggle)
      expect(props.onAutoClearMarksChange).toHaveBeenCalledWith(false)
    })

    it('the theme picker offers all three choices with the current one selected', async () => {
      const user = userEvent.setup()
      render(<ControlsHarness {...baseProps()} theme="dark" />)

      await user.click(settingsButton())
      expect(screen.getByRole('radio', { name: 'Light' })).not.toBeChecked()
      expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'System' })).not.toBeChecked()
    })

    it('picking a theme calls onThemeChange with that theme', async () => {
      const user = userEvent.setup()
      const props = baseProps()
      render(<ControlsHarness {...props} theme="system" />)

      await user.click(settingsButton())
      await user.click(screen.getByRole('radio', { name: 'Light' }))
      expect(props.onThemeChange).toHaveBeenCalledWith('light')
    })
  })

  describe('popover behaviour', () => {
    it('Escape closes the popover and returns focus to its trigger', async () => {
      const user = userEvent.setup()
      render(<ControlsHarness {...baseProps()} />)

      await user.click(settingsButton())
      // Focus opens on the theme picker's checked radio — the panel's first
      // control, and the only tab stop in its group.
      expect(screen.getByRole('radio', { name: 'System' })).toHaveFocus()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(settingsButton()).toHaveFocus()
      expect(settingsButton()).toHaveAttribute('aria-expanded', 'false')
    })

    it('opening one popover closes the other', async () => {
      const user = userEvent.setup()
      render(<ControlsHarness {...baseProps()} />)

      await user.click(newGameButton())
      expect(screen.getByRole('dialog', { name: 'Grid size' })).toBeInTheDocument()

      await user.click(settingsButton())
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: 'Grid size' })).not.toBeInTheDocument()
      expect(newGameButton()).toHaveAttribute('aria-expanded', 'false')
      expect(settingsButton()).toHaveAttribute('aria-expanded', 'true')
    })

    it('announces itself as modal and keeps Tab inside the panel', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlsHarness {...baseProps()} />
          <button type="button">outside</button>
        </div>,
      )

      await user.click(newGameButton())
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')

      const options = screen.getAllByRole('button', { name: /^\d by \d$/ })
      const first = options[0]
      const last = options[options.length - 1]

      // Tab off the end wraps to the top of the panel, not out to the board.
      last.focus()
      await user.tab()
      expect(first).toHaveFocus()

      // ...and back the other way.
      await user.tab({ shift: true })
      expect(last).toHaveFocus()

      expect(screen.getByRole('button', { name: 'outside' })).not.toHaveFocus()
    })

    it('opens focused on the current choice rather than the first option', async () => {
      const user = userEvent.setup()
      render(<ControlsHarness {...baseProps()} size={6} />)

      await user.click(newGameButton())
      expect(screen.getByRole('button', { name: '6 by 6' })).toHaveFocus()
    })

    it('a click outside closes the open popover', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlsHarness {...baseProps()} />
          <p>outside</p>
        </div>,
      )

      await user.click(settingsButton())
      await user.click(screen.getByText('outside'))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      // The player is already pointing elsewhere; focus must not snap back.
      expect(settingsButton()).not.toHaveFocus()
    })

    it('a dismissed-by-click popover still restores focus the next time Escape closes it', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlsHarness {...baseProps()} />
          <p>outside</p>
        </div>,
      )

      await user.click(settingsButton())
      await user.click(screen.getByText('outside'))
      expect(settingsButton()).not.toHaveFocus()

      // The "don't steal focus back" request was for that close only.
      await user.click(settingsButton())
      await user.keyboard('{Escape}')
      expect(settingsButton()).toHaveFocus()
    })
  })
})
