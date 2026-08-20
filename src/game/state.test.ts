import { describe, expect, it } from 'vitest'
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle'
import type { GameState } from './state'
import { createInitialState, gameReducer, isGridSolved } from './state'

function fresh(): GameState {
  return createInitialState(SAMPLE_PUZZLE)
}

const SOLUTION = SAMPLE_PUZZLE.solution

describe('createInitialState', () => {
  it('starts empty, unselected, in value mode, playing', () => {
    const state = fresh()
    expect(state.values).toEqual(new Array(16).fill(null))
    expect(state.marks).toEqual(Array.from({ length: 16 }, () => []))
    expect(state.selected).toBeNull()
    expect(state.mode).toBe('value')
    expect(state.status).toBe('playing')
    expect(state.past).toEqual([])
    expect(state.future).toEqual([])
  })
})

describe('SELECT / MOVE', () => {
  it('selects a valid cell', () => {
    const state = gameReducer(fresh(), { type: 'SELECT', index: 5 })
    expect(state.selected).toBe(5)
  })

  it('ignores out-of-range selection', () => {
    const state = gameReducer(fresh(), { type: 'SELECT', index: 99 })
    expect(state.selected).toBeNull()
  })

  it('moves in each direction', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 5 }) // row1,col1
    state = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(state.selected).toBe(6)
    state = gameReducer(state, { type: 'MOVE', direction: 'down' })
    expect(state.selected).toBe(10)
    state = gameReducer(state, { type: 'MOVE', direction: 'left' })
    expect(state.selected).toBe(9)
    state = gameReducer(state, { type: 'MOVE', direction: 'up' })
    expect(state.selected).toBe(5)
  })

  it('clamps at the top-left edge', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'MOVE', direction: 'up' })
    expect(state.selected).toBe(0)
    state = gameReducer(state, { type: 'MOVE', direction: 'left' })
    expect(state.selected).toBe(0)
  })

  it('clamps at the bottom-right edge', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 15 })
    state = gameReducer(state, { type: 'MOVE', direction: 'down' })
    expect(state.selected).toBe(15)
    state = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(state.selected).toBe(15)
  })

  it('does not clamp incorrectly across row boundaries', () => {
    // index 3 is top-right corner (row0,col3); moving right should stay put
    let state = gameReducer(fresh(), { type: 'SELECT', index: 3 })
    state = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(state.selected).toBe(3)
    // index 4 is row1,col0; moving left should stay put (not wrap to row0,col3)
    state = gameReducer(state, { type: 'SELECT', index: 4 })
    state = gameReducer(state, { type: 'MOVE', direction: 'left' })
    expect(state.selected).toBe(4)
  })

  it('MOVE with no prior selection starts from cell 0', () => {
    const state = gameReducer(fresh(), { type: 'MOVE', direction: 'right' })
    expect(state.selected).toBe(1)
  })

  it('selection changes do not affect undo/redo stacks', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    const pastLen = state.past.length
    state = gameReducer(state, { type: 'SELECT', index: 5 })
    state = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(state.past.length).toBe(pastLen)
  })
})

describe('DIGIT (value mode)', () => {
  it('enters a value into the selected cell', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    expect(state.values[0]).toBe(1)
  })

  it('does nothing when no cell is selected', () => {
    const state = gameReducer(fresh(), { type: 'DIGIT', value: 1 })
    expect(state.values).toEqual(new Array(16).fill(null))
  })

  it('ignores digits outside 1..size', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 5 })
    expect(state.values[0]).toBeNull()
    state = gameReducer(state, { type: 'DIGIT', value: 0 })
    expect(state.values[0]).toBeNull()
  })

  it('clears the cell pencil marks when a value is entered', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'SET_MODE', mode: 'mark' })
    state = gameReducer(state, { type: 'DIGIT', value: 2 })
    expect(state.marks[0]).toEqual([2])
    state = gameReducer(state, { type: 'SET_MODE', mode: 'value' })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    expect(state.values[0]).toBe(1)
    expect(state.marks[0]).toEqual([])
  })
})

describe('DIGIT (mark mode)', () => {
  it('toggles a mark on, then off', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'SET_MODE', mode: 'mark' })
    state = gameReducer(state, { type: 'DIGIT', value: 3 })
    expect(state.marks[0]).toEqual([3])
    state = gameReducer(state, { type: 'DIGIT', value: 3 })
    expect(state.marks[0]).toEqual([])
  })

  it('keeps marks sorted ascending regardless of entry order', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'SET_MODE', mode: 'mark' })
    state = gameReducer(state, { type: 'DIGIT', value: 4 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    state = gameReducer(state, { type: 'DIGIT', value: 2 })
    expect(state.marks[0]).toEqual([1, 2, 4])
  })

  it('does not mark a cell that already has a value', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    state = gameReducer(state, { type: 'SET_MODE', mode: 'mark' })
    state = gameReducer(state, { type: 'DIGIT', value: 2 })
    expect(state.marks[0]).toEqual([])
  })
})

describe('ERASE', () => {
  it('clears a value', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    state = gameReducer(state, { type: 'ERASE' })
    expect(state.values[0]).toBeNull()
  })

  it('clears marks too', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'SET_MODE', mode: 'mark' })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    state = gameReducer(state, { type: 'ERASE' })
    expect(state.marks[0]).toEqual([])
  })

  it('is a no-op on an already-empty cell (no history pushed)', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    const before = state.past.length
    state = gameReducer(state, { type: 'ERASE' })
    expect(state.past.length).toBe(before)
  })

  it('does nothing when no cell is selected', () => {
    const state = gameReducer(fresh(), { type: 'ERASE' })
    expect(state.values).toEqual(new Array(16).fill(null))
  })
})

describe('mode toggling', () => {
  it('SET_MODE sets an explicit mode', () => {
    const state = gameReducer(fresh(), { type: 'SET_MODE', mode: 'mark' })
    expect(state.mode).toBe('mark')
  })

  it('TOGGLE_MODE flips value <-> mark', () => {
    let state = fresh()
    expect(state.mode).toBe('value')
    state = gameReducer(state, { type: 'TOGGLE_MODE' })
    expect(state.mode).toBe('mark')
    state = gameReducer(state, { type: 'TOGGLE_MODE' })
    expect(state.mode).toBe('value')
  })
})

describe('undo / redo', () => {
  it('undoes a value entry', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    expect(state.values[0]).toBe(1)
    state = gameReducer(state, { type: 'UNDO' })
    expect(state.values[0]).toBeNull()
  })

  it('redoes after an undo', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    state = gameReducer(state, { type: 'UNDO' })
    state = gameReducer(state, { type: 'REDO' })
    expect(state.values[0]).toBe(1)
  })

  it('walks back across a sequence of actions in order', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 }) // values[0]=1
    state = gameReducer(state, { type: 'SELECT', index: 1 })
    state = gameReducer(state, { type: 'DIGIT', value: 2 }) // values[1]=2
    state = gameReducer(state, { type: 'ERASE' }) // values[1]=null again

    state = gameReducer(state, { type: 'UNDO' }) // undo erase -> values[1]=2
    expect(state.values).toEqual([1, 2, null, null, null, null, null, null, null, null, null, null, null, null, null, null])

    state = gameReducer(state, { type: 'UNDO' }) // undo digit(2) -> values[1]=null
    expect(state.values[1]).toBeNull()

    state = gameReducer(state, { type: 'UNDO' }) // undo digit(1) -> values[0]=null
    expect(state.values[0]).toBeNull()

    state = gameReducer(state, { type: 'UNDO' }) // nothing left to undo
    expect(state.values[0]).toBeNull()
  })

  it('a new mutating action invalidates the redo stack', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    state = gameReducer(state, { type: 'UNDO' })
    expect(state.future.length).toBe(1)

    state = gameReducer(state, { type: 'DIGIT', value: 2 })
    expect(state.future.length).toBe(0)
    state = gameReducer(state, { type: 'REDO' })
    expect(state.values[0]).toBe(2) // redo had nothing to apply; value stays as set
  })

  it('UNDO/REDO on empty stacks are no-ops', () => {
    const state = fresh()
    expect(gameReducer(state, { type: 'UNDO' })).toBe(state)
    expect(gameReducer(state, { type: 'REDO' })).toBe(state)
  })

  it('undo restores status alongside values', () => {
    // fill every cell but the last with the solution
    let state = fresh()
    for (let i = 0; i < 15; i++) {
      state = gameReducer(state, { type: 'SELECT', index: i })
      state = gameReducer(state, { type: 'DIGIT', value: SOLUTION[i] })
    }
    state = gameReducer(state, { type: 'SELECT', index: 15 })
    state = gameReducer(state, { type: 'DIGIT', value: SOLUTION[15] })
    expect(state.status).toBe('solved')

    state = gameReducer(state, { type: 'UNDO' })
    expect(state.status).toBe('playing')
  })
})

describe('RESET', () => {
  it('clears values and marks but keeps the puzzle, and is undoable', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    state = gameReducer(state, { type: 'RESET' })
    expect(state.values).toEqual(new Array(16).fill(null))
    expect(state.status).toBe('playing')

    state = gameReducer(state, { type: 'UNDO' })
    expect(state.values[0]).toBe(1)
  })
})

describe('NEW_PUZZLE', () => {
  it('replaces the puzzle and clears all state including history', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    const otherPuzzle = { ...SAMPLE_PUZZLE, seed: 'other' }
    state = gameReducer(state, { type: 'NEW_PUZZLE', puzzle: otherPuzzle })
    expect(state.puzzle).toBe(otherPuzzle)
    expect(state.values).toEqual(new Array(16).fill(null))
    expect(state.selected).toBeNull()
    expect(state.past).toEqual([])
    expect(state.future).toEqual([])
  })
})

describe('isGridSolved', () => {
  it('is false while cells remain empty', () => {
    expect(isGridSolved(SAMPLE_PUZZLE, new Array(16).fill(null))).toBe(false)
  })

  it('is false for a full but incorrect grid', () => {
    const wrong = SOLUTION.slice()
    wrong[0] = wrong[0] === SAMPLE_PUZZLE.size ? 1 : SAMPLE_PUZZLE.size
    expect(isGridSolved(SAMPLE_PUZZLE, wrong)).toBe(false)
  })

  it('is true only for the exact solution', () => {
    expect(isGridSolved(SAMPLE_PUZZLE, SOLUTION)).toBe(true)
  })

  it('flips reducer status to solved exactly on the final correct entry', () => {
    let state = fresh()
    for (let i = 0; i < 15; i++) {
      state = gameReducer(state, { type: 'SELECT', index: i })
      state = gameReducer(state, { type: 'DIGIT', value: SOLUTION[i] })
      expect(state.status).toBe('playing')
    }
    state = gameReducer(state, { type: 'SELECT', index: 15 })
    state = gameReducer(state, { type: 'DIGIT', value: SOLUTION[15] })
    expect(state.status).toBe('solved')
  })
})
