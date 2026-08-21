import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo } from 'react'
import { describe, expect, it } from 'vitest'
import { createErrorChecker } from '../engine'
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle'
import { useGame } from '../game/useGame'
import { Board } from './Board'
import { HintPanel } from './HintPanel'
import { Keypad } from './Keypad'
import { WinBanner } from './WinBanner'

/** A minimal wiring of useGame + Board + Keypad, standing in for App.tsx's game view. */
function TestGame() {
  const game = useGame(SAMPLE_PUZZLE)
  const checkErrors = useMemo(() => createErrorChecker(game.state.puzzle), [game.state.puzzle])
  const errors = useMemo(() => checkErrors(game.state.values), [checkErrors, game.state.values])
  return (
    <div>
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
      <WinBanner visible={game.state.status === 'solved'} />
      <Keypad
        size={game.state.puzzle.size}
        mode={game.state.mode}
        onDigit={game.enterDigit}
        onErase={game.erase}
        onToggleMode={game.toggleMode}
      />
      <button type="button" onClick={game.undo}>
        Undo
      </button>
      <button type="button" onClick={game.redo}>
        Redo
      </button>
      <button type="button" onClick={game.pressHint}>
        {game.hintPending ? 'Apply' : 'Hint'}
      </button>
      <label>
        <input
          type="checkbox"
          checked={game.state.autoClearMarks}
          onChange={(event) => game.setAutoClearMarks(event.target.checked)}
        />
        Auto-clear marks
      </label>
    </div>
  )
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

    await user.click(screen.getByRole('button', { name: 'Hint' }))
    expect(container.querySelector('.kk-hint__text')).toHaveTextContent(
      'The cage marked 2 has only one cell, so it has to be 2.',
    )
    expect(container.querySelector('.kk-hint__secondary')).toHaveTextContent('Given cell')
    // The explanation is all it does: the grid is untouched.
    expect(valueOf(cells[14])).toBeNull()
    expect(cells.every((cell) => valueOf(cell) === null)).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Apply' }))
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
    await user.click(screen.getByRole('button', { name: 'Hint' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await user.click(screen.getByRole('button', { name: 'Hint' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect([valueOf(cells[0]), valueOf(cells[1]), valueOf(cells[5])]).toEqual(['1', '2', '1'])

    await user.keyboard('{Control>}z{/Control}')
    expect([valueOf(cells[0]), valueOf(cells[1]), valueOf(cells[5])]).toEqual([null, null, null])
    expect(valueOf(cells[14])).toBe('2') // the earlier hint is still applied
  })

  it('highlights the hint’s cells and dims the rest', async () => {
    const user = userEvent.setup()
    render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    await user.click(screen.getByRole('button', { name: 'Hint' }))
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
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(cells[14].className).not.toContain('kk-cell--hint-focus')
    expect(cells[0].className).not.toContain('kk-cell--hint-dim')
  })

  it('a pending hint is invalidated as soon as the player edits the grid', async () => {
    const user = userEvent.setup()
    const { container } = render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    await user.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()

    await user.click(cells[0])
    await user.keyboard('1')

    expect(container.querySelector('.kk-hint__text')).not.toBeInTheDocument()
    expect(cells[14].className).not.toContain('kk-cell--hint-focus')
    // Back to "Hint": the next press explains afresh rather than applying a
    // hint that was computed against a grid that no longer exists.
    expect(screen.getByRole('button', { name: 'Hint' })).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Hint' }))

    expect(container.querySelector('.kk-hint__text')).toHaveTextContent(
      /row 1, column 1 doesn’t fit|row 1, column 1 doesn't fit/,
    )
    expect(cells[0].className).toContain('kk-cell--hint-focus')
    // A message has nothing to apply, so the button never offers to.
    expect(screen.getByRole('button', { name: 'Hint' })).toBeInTheDocument()

    // Pressing again re-runs rather than applying anything.
    await user.click(screen.getByRole('button', { name: 'Hint' }))
    expect(container.querySelector('.kk-hint__text')).toBeInTheDocument()
    expect(valueOf(cells[0])).toBe('2')
  })

  it('shows the win banner once the whole solution is entered', async () => {
    const user = userEvent.setup()
    render(<TestGame />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    const cells = screen.getAllByRole('gridcell')
    for (let i = 0; i < SAMPLE_PUZZLE.solution.length; i++) {
      await user.click(cells[i])
      await user.keyboard(String(SAMPLE_PUZZLE.solution[i]))
    }

    expect(screen.getByRole('status')).toHaveTextContent(/solved/i)
  })

  it('entering a value clears the matching pencil mark from row/column peers, leaving unrelated marks', async () => {
    const user = userEvent.setup()
    render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    // Cells 1 and 2 both share row 0 with cell 0.
    await user.click(screen.getByRole('button', { name: 'Marks: Off' }))
    await user.click(cells[1])
    await user.keyboard('3')
    await user.click(cells[2])
    await user.keyboard('4')
    expect(marksOf(cells[1])).toEqual(['3'])
    expect(marksOf(cells[2])).toEqual(['4'])

    await user.click(screen.getByRole('button', { name: 'Marks: On' }))
    await user.click(cells[0])
    await user.keyboard('3')

    // The 3 pencilled into cell 1 is now impossible in this row and disappears...
    expect(marksOf(cells[1])).toEqual([])
    // ...but cell 2's unrelated 4 is untouched.
    expect(marksOf(cells[2])).toEqual(['4'])
  })

  it('unchecking auto-clear marks leaves peer pencil marks in place after entering a value', async () => {
    const user = userEvent.setup()
    render(<TestGame />)
    const cells = screen.getAllByRole('gridcell')

    await user.click(screen.getByLabelText('Auto-clear marks'))
    expect(screen.getByLabelText('Auto-clear marks')).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Marks: Off' }))
    await user.click(cells[1])
    await user.keyboard('3')
    expect(marksOf(cells[1])).toEqual(['3'])

    await user.click(screen.getByRole('button', { name: 'Marks: On' }))
    await user.click(cells[0])
    await user.keyboard('3')

    expect(marksOf(cells[1])).toEqual(['3'])
  })
})
