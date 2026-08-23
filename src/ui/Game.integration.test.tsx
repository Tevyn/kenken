import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { createErrorChecker } from '../engine'
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle'
import type { Theme } from '../game/preferences'
import { useGame } from '../game/useGame'
import { Board } from './Board'
import { Controls } from './Controls'
import type { OpenMenu } from './Controls'
import { HintPanel } from './HintPanel'
import { Keypad } from './Keypad'
import { WinDialog } from './WinDialog'

/** A minimal wiring of useGame + Board + Keypad, standing in for App.tsx's game view. */
function TestGame() {
  // Same arrangement as App: the open popover is owned above the game, because
  // an open panel suspends the board's keyboard shortcuts.
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const [theme, setTheme] = useState<Theme>('system')
  // The solved dialog is modal too, so it suspends the board's keyboard the
  // same way an open popover does. Same two-flag arrangement as App.
  const [solvedSeen, setSolvedSeen] = useState(false)
  const [winDismissed, setWinDismissed] = useState(false)
  const winOpen = solvedSeen && !winDismissed
  const game = useGame(SAMPLE_PUZZLE, { suspended: openMenu !== null || winOpen })
  const solved = game.state.status === 'solved'
  if (solved !== solvedSeen) {
    setSolvedSeen(solved)
    setWinDismissed(false)
  }
  const checkErrors = useMemo(() => createErrorChecker(game.state.puzzle), [game.state.puzzle])
  const errors = useMemo(() => checkErrors(game.state.values), [checkErrors, game.state.values])
  return (
    <div>
      <Controls
        size={game.state.puzzle.size}
        difficulty={game.state.puzzle.difficulty}
        onStartGame={() => {}}
        autoClearMarks={game.state.autoClearMarks}
        onAutoClearMarksChange={game.setAutoClearMarks}
        theme={theme}
        onThemeChange={setTheme}
        openMenu={openMenu}
        onOpenMenuChange={setOpenMenu}
      />
      <Board
        puzzle={game.state.puzzle}
        values={game.state.values}
        marks={game.state.marks}
        selected={game.state.selected}
        errors={errors}
        highlight={game.highlight}
        onSelect={game.select}
      />
      <HintPanel phase={game.state.hint} onDismiss={game.dismissHint} onReveal={game.revealCell} />
      <WinDialog
        visible={winOpen}
        onDismiss={() => setWinDismissed(true)}
        onNewGame={() => {
          setWinDismissed(true)
          setOpenMenu('new-game')
        }}
      />
      <Keypad
        size={game.state.puzzle.size}
        mode={game.state.mode}
        onDigit={game.enterDigit}
        onErase={game.erase}
        onToggleMode={game.toggleMode}
        onUndo={game.undo}
        onRedo={game.redo}
        canUndo={game.canUndo}
        canRedo={game.canRedo}
        onHint={game.pressHint}
        hintPending={game.hintPending}
      />
    </div>
  )
}

/** The hint button, by whichever of its two labels it is currently wearing. */
function hintButton(pending = false): HTMLElement {
  return screen.getByRole('button', { name: pending ? 'Apply' : 'Hint' })
}

/** The notes toggle: one button, `aria-pressed` tells you which way it is. */
function marksButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Notes' })
}

/** Cell 0 always shows its cage label ("1-"), so assert on the value span, not raw text. */
function valueOf(cell: HTMLElement): string | null {
  return cell.querySelector('.kk-cell__value')?.textContent ?? null
}

/** The pencil-mark digits currently displayed in a cell, in ascending order. */
function marksOf(cell: HTMLElement): string[] {
  return Array.from(cell.querySelectorAll('.kk-cell__mark'))
    .map((mark) => mark.textContent ?? '')
    .filter((text) => text !== '')
}

describe('Board + Keypad + useGame integration', () => {
  it('select a cell, type a digit via keyboard, see it, undo, see it gone', async () => {
    const user = userEvent.setup()
    render(<TestGame />)

    const cells = screen.getAllByRole('gridcell')
    await user.click(cells[0])
    await user.keyboard('7')
    // digit 7 is out of range for a 4x4 puzzle -> ignored
    expect(valueOf(cells[0])).toBeNull()

    await user.keyboard('2')
    expect(valueOf(cells[0])).toBe('2')

    await user.keyboard('{Control>}z{/Control}')
    expect(valueOf(cells[0])).toBeNull()
  })

  it('select a cell, click a keypad digit, see it rendered, undo via button, see it gone', async () => {
    const user = userEvent.setup()
    render(<TestGame />)

    const cells = screen.getAllByRole('gridcell')
    await user.click(cells[0])
    await user.click(screen.getByRole('button', { name: 'Enter 1' }))
    expect(valueOf(cells[0])).toBe('1')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(valueOf(cells[0])).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(valueOf(cells[0])).toBe('1')
  })

  it('highlights both cells when a digit is duplicated in a row', async () => {
    const user = userEvent.setup()
    const { container } = render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    // Cells 4 and 6 share row 1, and 2 is legal in either of their cages on its
    // own — so the only thing wrong here is the repeat.
    await user.click(cells[4])
    await user.keyboard('2')
    expect(cells[4].className).not.toContain('kk-cell--error')

    await user.click(cells[6])
    await user.keyboard('2')
    expect(cells[4].className).toContain('kk-cell--error')
    expect(cells[6].className).toContain('kk-cell--error')
    expect(cells[4].getAttribute('aria-label')).toMatch(/, conflict$/)
    expect(container.querySelector('.kk-board__errors')).toHaveTextContent('2 cells conflict')

    // Undoing the second entry clears both highlights.
    await user.keyboard('{Backspace}')
    expect(cells[4].className).not.toContain('kk-cell--error')
    expect(cells[6].className).not.toContain('kk-cell--error')
    expect(container.querySelector('.kk-board__errors')).toBeEmptyDOMElement()
  })

  it('highlights a cell whose cage can no longer be completed', async () => {
    const user = userEvent.setup()
    render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    // Cage "11+" over cells 9, 12 and 13 can only ever be 4 + 4 + 3, so a 1 in
    // cell 9 is already lost even though the cage is still mostly empty.
    await user.click(cells[9])
    await user.keyboard('1')
    expect(cells[9].className).toContain('kk-cell--error')
    expect(cells[12].className).not.toContain('kk-cell--error')
    expect(cells[13].className).not.toContain('kk-cell--error')
  })

  /*
   * On this fixture's empty grid the easiest step is the one-cell "2" cage at
   * index 14, so the first press always explains that and the second writes it.
   */
  it('explains a hint on the first press and only writes it on the second', async () => {
    const user = userEvent.setup()
    const { container } = render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    await user.click(hintButton())
    expect(container.querySelector('.kk-hint__text')).toHaveTextContent(
      'The cage marked 2 has only one cell, so it has to be 2.',
    )
    expect(container.querySelector('.kk-hint__secondary')).toHaveTextContent('Given cell')
    // The explanation is all it does: the grid is untouched.
    expect(valueOf(cells[14])).toBeNull()
    expect(cells.every((cell) => valueOf(cell) === null)).toBe(true)

    await user.click(hintButton(true))
    expect(valueOf(cells[14])).toBe('2')
    expect(container.querySelector('.kk-hint__text')).not.toBeInTheDocument()

    await user.keyboard('{Control>}z{/Control}')
    expect(valueOf(cells[14])).toBeNull()
    expect(cells.every((cell) => valueOf(cell) === null)).toBe(true)
  })

  it('undoes a multi-cell hint in a single step', async () => {
    const user = userEvent.setup()
    render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    // Take and apply the freebie first so the next hint is the three-cell
    // "only one way to fill the 2x cage" placement over cells 0, 1 and 5.
    await user.click(hintButton())
    await user.click(hintButton(true))
    await user.click(hintButton())
    await user.click(hintButton(true))
    expect([valueOf(cells[0]), valueOf(cells[1]), valueOf(cells[5])]).toEqual(['1', '2', '1'])

    await user.keyboard('{Control>}z{/Control}')
    expect([valueOf(cells[0]), valueOf(cells[1]), valueOf(cells[5])]).toEqual([null, null, null])
    expect(valueOf(cells[14])).toBe('2') // the earlier hint is still applied
  })

  it('highlights the hint’s cells and dims the rest', async () => {
    const user = userEvent.setup()
    render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    await user.click(hintButton())
    expect(cells[14].className).toContain('kk-cell--hint-focus')
    expect(cells[14].className).toContain('kk-cell--hint-cage')
    expect(cells[14].getAttribute('aria-label')).toMatch(/, hint focus$/)
    // Cage 6 is the single cell 14, so it is outlined on all four sides.
    for (const side of ['t', 'r', 'b', 'l']) {
      expect(cells[14].className).toContain(`kk-cell--hint-cage-${side}`)
    }
    expect(cells[0].className).toContain('kk-cell--hint-dim')
    expect(cells[0].className).not.toContain('kk-cell--hint-focus')

    // Applying clears the highlight along with the explanation.
    await user.click(hintButton(true))
    expect(cells[14].className).not.toContain('kk-cell--hint-focus')
    expect(cells[0].className).not.toContain('kk-cell--hint-dim')
  })

  it('a pending hint is invalidated as soon as the player edits the grid', async () => {
    const user = userEvent.setup()
    const { container } = render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    await user.click(hintButton())
    expect(hintButton(true)).toBeInTheDocument()

    await user.click(cells[0])
    await user.keyboard('1')

    expect(container.querySelector('.kk-hint__text')).not.toBeInTheDocument()
    expect(cells[14].className).not.toContain('kk-cell--hint-focus')
    // Back to "Hint": the next press explains afresh rather than applying a
    // hint that was computed against a grid that no longer exists.
    expect(hintButton()).toBeInTheDocument()
    expect(valueOf(cells[14])).toBeNull()
  })

  it('the H shortcut drives both presses, and Escape dismisses', async () => {
    const user = userEvent.setup()
    const { container } = render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    await user.keyboard('h')
    expect(container.querySelector('.kk-hint__text')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(container.querySelector('.kk-hint__text')).not.toBeInTheDocument()
    expect(valueOf(cells[14])).toBeNull()

    await user.keyboard('hh')
    expect(valueOf(cells[14])).toBe('2')
  })

  it('reports a wrong entry instead of a step, and points at the cell', async () => {
    const user = userEvent.setup()
    const { container } = render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    // Cell 0 is 1 in the solution; 2 is legal in its cage, so nothing else flags it.
    await user.click(cells[0])
    await user.keyboard('2')
    await user.click(hintButton())

    expect(container.querySelector('.kk-hint__text')).toHaveTextContent(
      /row 1, column 1 doesn’t fit|row 1, column 1 doesn't fit/,
    )
    expect(cells[0].className).toContain('kk-cell--hint-focus')
    // A message has nothing to apply, so the button never offers to.
    expect(hintButton()).toBeInTheDocument()

    // Pressing again re-runs rather than applying anything.
    await user.click(hintButton())
    expect(container.querySelector('.kk-hint__text')).toBeInTheDocument()
    expect(valueOf(cells[0])).toBe('2')
  })

  it('shows the solved dialog once the whole solution is entered, and lets it be dismissed', async () => {
    const user = userEvent.setup()
    render(<TestGame />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const cells = screen.getAllByRole('gridcell')
    for (let i = 0; i < SAMPLE_PUZZLE.solution.length; i++) {
      await user.click(cells[i])
      await user.keyboard(String(SAMPLE_PUZZLE.solution[i]))
    }

    expect(screen.getByRole('dialog', { name: 'Solved' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/nice work/i)

    // Dismissing leaves the finished board on screen and hands the keyboard back.
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(valueOf(cells[0])).toBe(String(SAMPLE_PUZZLE.solution[0]))
  })

  it('the solved dialog hands off to the new-game wizard, focus and all', async () => {
    const user = userEvent.setup()
    render(<TestGame />)

    const cells = screen.getAllByRole('gridcell')
    for (let i = 0; i < SAMPLE_PUZZLE.solution.length; i++) {
      await user.click(cells[i])
      await user.keyboard(String(SAMPLE_PUZZLE.solution[i]))
    }

    // Two buttons wear the label at this moment - the header trigger and the
    // dialog's own. Only the dialog is reachable, so only it is asked.
    const solvedDialog = screen.getByRole('dialog', { name: 'Solved' })
    await user.click(within(solvedDialog).getByRole('button', { name: 'New game' }))

    /*
     * One panel closes as the other opens. The button that was pressed goes
     * with the closing panel, so the arriving wizard has to be the one that
     * ends up with focus - on the size being played, as always.
     */
    expect(screen.queryByRole('dialog', { name: 'Solved' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Size' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4 by 4' })).toHaveFocus()
  })

  it('entering a value clears the matching pencil mark from row/column peers, leaving unrelated marks', async () => {
    const user = userEvent.setup()
    render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    // Cells 1 and 2 both share row 0 with cell 0.
    await user.click(marksButton())
    await user.click(cells[1])
    await user.keyboard('3')
    await user.click(cells[2])
    await user.keyboard('4')
    expect(marksOf(cells[1])).toEqual(['3'])
    expect(marksOf(cells[2])).toEqual(['4'])

    await user.click(marksButton())
    await user.click(cells[0])
    await user.keyboard('3')

    // The 3 pencilled into cell 1 is now impossible in this row and disappears...
    expect(marksOf(cells[1])).toEqual([])
    // ...but cell 2's unrelated 4 is untouched.
    expect(marksOf(cells[2])).toEqual(['4'])
  })

  it('switching auto-clear marks off leaves peer pencil marks in place after entering a value', async () => {
    const user = userEvent.setup()
    render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('switch', { name: 'Auto-clear notes' }))
    expect(screen.getByRole('switch', { name: 'Auto-clear notes' })).not.toBeChecked()

    // No need to dismiss the popover first: the next press outside it closes
    // it, which hands the keyboard back to the board.
    await user.click(marksButton())
    await user.click(cells[1])
    await user.keyboard('3')
    expect(marksOf(cells[1])).toEqual(['3'])

    await user.click(marksButton())
    await user.click(cells[0])
    await user.keyboard('3')

    expect(marksOf(cells[1])).toEqual(['3'])
  })

  // Space is the pencil-mark shortcut, so it must reach the focused switch and
  // not the board. This one is covered twice over — by the `<input>` guard and
  // by the popover suspending the shortcuts — and has to hold either way.
  it('Space toggles the focused auto-clear switch without toggling pencil-mark mode', async () => {
    const user = userEvent.setup()
    render(<TestGame />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    // The panel opens focused on the theme picker's current choice (the first
    // control in it); the switch is the next tab stop.
    expect(screen.getByRole('radio', { name: 'System' })).toHaveFocus()
    await user.tab()

    const toggle = screen.getByRole('switch', { name: 'Auto-clear notes' })
    expect(toggle).toHaveFocus()
    expect(toggle).toBeChecked()
    expect(marksButton()).toHaveAttribute('aria-pressed', 'false')

    await user.keyboard(' ')

    expect(toggle).not.toBeChecked()
    expect(marksButton()).toHaveAttribute('aria-pressed', 'false')
  })

  /*
   * The wizard panel is nothing but `<button>`s, so nothing about the focused
   * element says "leave the keyboard alone" — the app has to say so explicitly.
   */
  describe('an open popover owns the keyboard', () => {
    it('digits, H and Backspace never reach the hidden board', async () => {
      const user = userEvent.setup()
      const { container } = render(<TestGame />)
      const cells = screen.getAllByRole('gridcell')

      await user.click(cells[0])
      await user.keyboard('1')
      expect(valueOf(cells[0])).toBe('1')

      await user.click(screen.getByRole('button', { name: 'New game' }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      await user.keyboard('4')
      expect(valueOf(cells[0])).toBe('1')

      await user.keyboard('h')
      expect(container.querySelector('.kk-hint__text')).not.toBeInTheDocument()
      expect(hintButton()).toBeInTheDocument()

      await user.keyboard('{Backspace}')
      expect(valueOf(cells[0])).toBe('1')

      // Arrows belong to the panel too, so the selection stays where it was.
      await user.keyboard('{ArrowRight}')
      expect(cells[0].className).toContain('kk-cell--selected')
      expect(cells[1].className).not.toContain('kk-cell--selected')

      // Escape closes the panel, and only then does the board answer again.
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await user.click(cells[0])
      await user.keyboard('{Backspace}')
      expect(valueOf(cells[0])).toBeNull()
    })

    it('Space activates the focused wizard option instead of flipping pencil-mark mode', async () => {
      const user = userEvent.setup()
      render(<TestGame />)

      await user.click(screen.getByRole('button', { name: 'New game' }))
      // The panel opens on the size being played, which is the 4x4 fixture.
      const current = screen.getByRole('button', { name: '4 by 4' })
      expect(current).toHaveFocus()
      expect(marksButton()).toHaveAttribute('aria-pressed', 'false')

      await user.keyboard(' ')

      // Space pressed the button, so the wizard advanced to step two...
      expect(screen.getByRole('button', { name: 'Easy' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '4 by 4' })).not.toBeInTheDocument()
      // ...and the game's own Space shortcut never fired.
      expect(marksButton()).toHaveAttribute('aria-pressed', 'false')
    })
  })
})
