import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle'
import { useGame } from '../game/useGame'
import { Board } from './Board'
import { Keypad } from './Keypad'
import { WinBanner } from './WinBanner'

/** A minimal wiring of useGame + Board + Keypad, standing in for App.tsx's game view. */
function TestGame() {
  const game = useGame(SAMPLE_PUZZLE)
  return (
    <div>
      <Board
        puzzle={game.state.puzzle}
        values={game.state.values}
        marks={game.state.marks}
        selected={game.state.selected}
        onSelect={game.select}
      />
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
    </div>
  )
}

/** Cell 0 always shows its cage label ("1-"), so assert on the value span, not raw text. */
function valueOf(cell: HTMLElement): string | null {
  return cell.querySelector('.kk-cell__value')?.textContent ?? null
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
})
