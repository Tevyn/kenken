import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { SAMPLE_PUZZLE } from './fixtures/samplePuzzle'

/*
 * Generation is the engine's job and is tested there; here it only has to be
 * fast and controllable, so the app's own wiring — focus, the loading shell,
 * what the wizard claims is current — can be asserted.
 */
const generatePuzzle = vi.hoisted(() => vi.fn())

vi.mock('./engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engine')>()
  return { ...actual, generatePuzzle }
})

const newGameButton = () => screen.getByRole('button', { name: 'New game' })

/** Run the wizard end to end: open, pick a size, pick a difficulty. */
async function startGame(
  user: ReturnType<typeof userEvent.setup>,
  size: number,
  difficulty: string,
) {
  await user.click(newGameButton())
  await user.click(screen.getByRole('button', { name: `${size} by ${size}` }))
  await user.click(screen.getByRole('button', { name: difficulty }))
}

/**
 * Commit the wizard without letting the clock run on.
 *
 * Generation is deferred by a `setTimeout(0)` so the loading state gets painted
 * first — and that paint is what these tests are about. `userEvent` yields to
 * the macrotask queue between actions, so the whole thing would be over before
 * the next assertion; a bare `fireEvent` stops exactly where the browser would.
 */
async function pickSize(user: ReturnType<typeof userEvent.setup>, size: number) {
  await user.click(newGameButton())
  await user.click(screen.getByRole('button', { name: `${size} by ${size}` }))
}

function commitDifficulty(difficulty: string) {
  fireEvent.click(screen.getByRole('button', { name: difficulty }))
}

describe('App', () => {
  beforeEach(() => {
    generatePuzzle.mockReset()
    generatePuzzle.mockReturnValue(SAMPLE_PUZZLE)
  })

  it('keeps focus on the new-game trigger once the wizard commits', async () => {
    const user = userEvent.setup()
    render(<App />)

    await pickSize(user, 6)
    commitDifficulty('Medium')

    // The same commit closes the panel and marks the trigger unavailable; the
    // trigger still has to be able to take focus back, or Tab restarts from the
    // top of the document.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(newGameButton()).toHaveAttribute('aria-disabled', 'true')
    expect(newGameButton()).toHaveFocus()

    await waitFor(() => expect(newGameButton()).not.toHaveAttribute('aria-disabled'))
    expect(newGameButton()).toHaveFocus()
  })

  it('keeps the board and keypad on screen while a puzzle generates', async () => {
    const user = userEvent.setup()
    render(<App />)

    await pickSize(user, 5)
    commitDifficulty('Easy')

    expect(screen.getByText('Generating…')).toBeInTheDocument()
    // The page does not collapse to one line: the outgoing board is the
    // placeholder, dimmed and out of reach.
    expect(screen.getAllByRole('gridcell')).toHaveLength(16)
    expect(screen.getByRole('button', { name: 'Hint' })).toBeInTheDocument()
    // Both zones recede together, now that the board and the controls are
    // siblings rather than one column: the outgoing grid must not be typed
    // into, so the keypad has to go out of reach with it.
    expect(document.querySelectorAll('.kk-is-busy')).toHaveLength(2)
    expect(document.querySelector('.kk-app__controls')).toHaveClass('kk-is-busy')

    await waitFor(() => expect(screen.queryByText('Generating…')).not.toBeInTheDocument())
    expect(document.querySelectorAll('.kk-is-busy')).toHaveLength(0)
    expect(generatePuzzle).toHaveBeenCalledWith({ size: 5, difficulty: 'easy' })
  })

  it('a failed generation leaves the wizard agreeing with the board still on screen', async () => {
    const user = userEvent.setup()
    generatePuzzle.mockImplementation(() => {
      throw new Error('Could not generate a puzzle.')
    })
    render(<App />)

    await startGame(user, 6, 'Hard')
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Could not generate a puzzle.'),
    )

    // Nothing changed, so the wizard must still point at the 4x4 easy fixture
    // rather than at the size and difficulty that failed.
    await user.click(newGameButton())
    expect(screen.getByRole('button', { name: '4 by 4' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: '6 by 6' })).not.toHaveAttribute('aria-current')

    await user.click(screen.getByRole('button', { name: '4 by 4' }))
    expect(screen.getByRole('button', { name: 'Easy' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Hard' })).not.toHaveAttribute('aria-current')
  })
})
