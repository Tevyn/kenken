import { describe, expect, it } from 'vitest'
import type { Hint } from '../engine/hints'
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle'
import type { GameState } from './state'
import { createInitialState, gameReducer, hintHighlight, isGridSolved } from './state'

function fresh(): GameState {
  return createInitialState(SAMPLE_PUZZLE)
}

const SOLUTION = SAMPLE_PUZZLE.solution

/** Drop pencil marks straight into a state, rather than toggling 20 keys. */
function withMarks(state: GameState, at: Record<number, number[]>): GameState {
  return { ...state, marks: state.marks.map((m, i) => at[i] ?? m) }
}

/** Select a cell and type into it, the way the keyboard handler would. */
function enter(state: GameState, index: number, value: number): GameState {
  return gameReducer(gameReducer(state, { type: 'SELECT', index }), { type: 'DIGIT', value })
}

/** Turn auto-clearing off, so marks can be left deliberately stale. */
function turnOff(state: GameState): GameState {
  return gameReducer(state, { type: 'SET_AUTO_CLEAR_MARKS', enabled: false })
}

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

  it('auto-clears marks by default, and honours an explicit preference', () => {
    expect(fresh().autoClearMarks).toBe(true)
    expect(createInitialState(SAMPLE_PUZZLE, false).autoClearMarks).toBe(false)
    expect(createInitialState(SAMPLE_PUZZLE, true).autoClearMarks).toBe(true)
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

describe('auto-clearing pencil marks', () => {
  // Cell 5 is row 1, column 1, so its peers are cells 4, 6, 7 and 1, 9, 13.
  // Cell 10 is in neither that row nor that column: it is the control.
  function withPeerMarks(state: GameState): GameState {
    return withMarks(state, { 4: [1, 2], 6: [2, 3], 13: [1, 3, 4], 10: [3] })
  }

  function turn(state: GameState, enabled: boolean): GameState {
    return gameReducer(state, { type: 'SET_AUTO_CLEAR_MARKS', enabled })
  }

  it('strips the entered digit from row and column peers only', () => {
    const state = enter(withPeerMarks(fresh()), 5, 3)
    expect(state.marks[6]).toEqual([2]) // row peer, its other digits survive
    expect(state.marks[13]).toEqual([1, 4]) // column peer, likewise
    expect(state.marks[4]).toEqual([1, 2]) // row peer that never held a 3
    expect(state.marks[10]).toEqual([3]) // unrelated cell: untouched
  })

  it('undoes the entry and every mark it stripped in a single step', () => {
    const start = withPeerMarks(fresh())
    const after = enter(start, 5, 3)
    expect(after.past).toHaveLength(1)

    const undone = gameReducer(after, { type: 'UNDO' })
    expect(undone.values).toEqual(start.values)
    expect(undone.marks).toEqual(start.marks)
    expect(undone.past).toHaveLength(0)
  })

  it('leaves peer marks alone while the setting is off', () => {
    const state = enter(turn(withPeerMarks(fresh()), false), 5, 3)
    expect(state.values[5]).toBe(3)
    expect(state.marks[6]).toEqual([2, 3])
    expect(state.marks[13]).toEqual([1, 3, 4])
  })

  it('never sweeps on a pencil mark, only on a value', () => {
    let state = gameReducer(withPeerMarks(fresh()), { type: 'SET_MODE', mode: 'mark' })
    state = enter(state, 5, 3)
    expect(state.marks[5]).toEqual([3])
    expect(state.marks[6]).toEqual([2, 3])
    expect(state.marks[13]).toEqual([1, 3, 4])
  })

  it('sweeps the whole board when switched on, and the sweep is undoable', () => {
    // Build a board with stale marks by filling cells with the setting off.
    let stale = enter(turn(fresh(), false), 5, 3)
    stale = enter(stale, 15, 1) // row 3 and column 3 peers: 12, 13, 14 and 3, 7, 11
    stale = withPeerMarks(withMarks(stale, { 3: [1, 4], 12: [1, 2] }))

    const swept = turn(stale, true)
    expect(swept.autoClearMarks).toBe(true)
    expect(swept.marks[6]).toEqual([2]) // cleaned by the 3 at cell 5
    expect(swept.marks[13]).toEqual([4]) // cleaned by both entries
    expect(swept.marks[12]).toEqual([2]) // cleaned by the 1 at cell 15
    expect(swept.marks[3]).toEqual([4])
    expect(swept.marks[10]).toEqual([3]) // contradicts nothing on the board
    expect(swept.past).toHaveLength(stale.past.length + 1)

    const undone = gameReducer(swept, { type: 'UNDO' })
    expect(undone.marks).toEqual(stale.marks)
    // The preference is not board state, so undoing the sweep leaves it on.
    expect(undone.autoClearMarks).toBe(true)
  })

  it('adds no undo entry when the sweep has nothing to clean', () => {
    const off = turn(withPeerMarks(fresh()), false)
    const on = turn(off, true)
    expect(on.autoClearMarks).toBe(true)
    expect(on.marks).toEqual(off.marks)
    expect(on.past).toHaveLength(off.past.length)
  })

  it('switching it off restores nothing and takes no history slot', () => {
    const after = enter(withPeerMarks(fresh()), 5, 3)
    const off = turn(after, false)
    expect(off.autoClearMarks).toBe(false)
    expect(off.marks[6]).toEqual([2])
    expect(off.past).toHaveLength(after.past.length)
  })

  it('setting it to the value it already holds is a no-op', () => {
    const on = fresh()
    expect(turn(on, true)).toBe(on)
    const off = turn(on, false)
    expect(turn(off, false)).toBe(off)
  })

  it('RESET and NEW_PUZZLE preserve the setting', () => {
    const off = turn(fresh(), false)
    expect(gameReducer(off, { type: 'RESET' }).autoClearMarks).toBe(false)
    expect(gameReducer(off, { type: 'NEW_PUZZLE', puzzle: SAMPLE_PUZZLE }).autoClearMarks).toBe(
      false,
    )

    const on = fresh()
    expect(gameReducer(on, { type: 'RESET' }).autoClearMarks).toBe(true)
    expect(gameReducer(on, { type: 'NEW_PUZZLE', puzzle: SAMPLE_PUZZLE }).autoClearMarks).toBe(true)
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

/* ------------------------------------------------------------------ */
/* Hints                                                                */
/* ------------------------------------------------------------------ */

/**
 * The real rank-10 hint `findHint` returns for this fixture's empty grid —
 * cage 6 is the single cell 14 with target 2. Hand-built here so the reducer
 * tests stay a pure function of their inputs, with no engine call.
 */
function fakeHint(overrides: Partial<Hint> = {}): Hint {
  return {
    technique: 'freebie-cage',
    rank: 10,
    text: 'The cage marked 2 has only one cell, so it has to be 2.',
    secondary: 'Given cell',
    highlight: {
      focus: [14],
      support: [],
      rows: [],
      cols: [],
      cages: [6],
      dimRest: true,
      strike: [],
    },
    apply: { kind: 'place', cells: [{ cell: 14, value: 2 }] },
    signature: 'freebie-cage|14|2',
    ...overrides,
  }
}

function shown(state: GameState, hint: Hint): GameState {
  return gameReducer(state, { type: 'REQUEST_HINT', result: { kind: 'hint', hint } })
}

function applied(state: GameState, hint: Hint, visible: number[][] = []): GameState {
  return gameReducer(state, {
    type: 'APPLY_HINT',
    apply: hint.apply,
    visible,
    signature: hint.signature,
  })
}

describe('REQUEST_HINT / DISMISS_HINT', () => {
  it('starts idle with no remembered signatures', () => {
    expect(fresh().hint).toEqual({ kind: 'idle' })
    expect(fresh().recentHints).toEqual([])
  })

  it('shows a hint without touching the grid', () => {
    const hint = fakeHint()
    const state = shown(fresh(), hint)
    expect(state.hint).toEqual({ kind: 'shown', hint })
    expect(state.values).toEqual(new Array(16).fill(null))
    expect(state.past).toEqual([])
  })

  it('stores the mistake / stuck / solved arms as a message', () => {
    const result = {
      kind: 'mistake' as const,
      cells: [3],
      text: 'Something on the board can’t be right.',
      secondary: 'Check this cell',
    }
    const state = gameReducer(fresh(), { type: 'REQUEST_HINT', result })
    expect(state.hint).toEqual({ kind: 'message', message: result })
  })

  it('DISMISS_HINT returns to idle, and is a no-op when already idle', () => {
    const state = shown(fresh(), fakeHint())
    expect(gameReducer(state, { type: 'DISMISS_HINT' }).hint).toEqual({ kind: 'idle' })
    const idle = fresh()
    expect(gameReducer(idle, { type: 'DISMISS_HINT' })).toBe(idle)
  })

  // A shown hint is dismissed by whatever changes the board under it, and only
  // by that — so an auto-clear sweep dismisses one exactly when it has marks to
  // clear, and a sweep that finds nothing leaves the explanation on screen.
  it('a sweep dismisses a shown hint only when it actually changes the board', () => {
    const stale = enter(withMarks(turnOff(fresh()), { 6: [1, 2] }), 5, 1)
    const swept = gameReducer(shown(stale, fakeHint()), {
      type: 'SET_AUTO_CLEAR_MARKS',
      enabled: true,
    })
    expect(swept.marks[6]).toEqual([2])
    expect(swept.hint).toEqual({ kind: 'idle' })

    const hint = fakeHint()
    const clean = shown(turnOff(fresh()), hint)
    const noop = gameReducer(clean, { type: 'SET_AUTO_CLEAR_MARKS', enabled: true })
    expect(noop.hint).toEqual({ kind: 'shown', hint })
  })
})

describe('APPLY_HINT (place)', () => {
  it('writes the value, clears that cell’s marks, and tidies peer marks', () => {
    // Cell 14 is row 4, column 3: its peers are the rest of row 4 and column 3.
    const start = withMarks(fresh(), { 14: [1, 2], 12: [1, 2, 3], 6: [2, 4], 5: [2] })
    const state = applied(shown(start, fakeHint()), fakeHint())

    expect(state.values[14]).toBe(2)
    expect(state.marks[14]).toEqual([])
    expect(state.marks[12]).toEqual([1, 3]) // row peer
    expect(state.marks[6]).toEqual([4]) // column peer
    expect(state.marks[5]).toEqual([2]) // neither: untouched
    expect(state.hint).toEqual({ kind: 'idle' })
  })

  it('places every cell of a multi-cell hint and recomputes status', () => {
    const hint = fakeHint({
      technique: 'single-cage-combination',
      apply: {
        kind: 'place',
        cells: [
          { cell: 0, value: 1 },
          { cell: 1, value: 2 },
          { cell: 5, value: 1 },
        ],
      },
      signature: 'single-cage-combination|0,1,5|1,2',
    })
    const state = applied(fresh(), hint)
    expect(state.values.slice(0, 6)).toEqual([1, 2, null, null, null, 1])
    expect(state.status).toBe('playing')
  })

  it('flips status to solved when the hint fills the final cell', () => {
    let state = fresh()
    for (let i = 0; i < 15; i++) {
      state = gameReducer(state, { type: 'SELECT', index: i })
      state = gameReducer(state, { type: 'DIGIT', value: SOLUTION[i] })
    }
    const hint = fakeHint({
      apply: { kind: 'place', cells: [{ cell: 15, value: SOLUTION[15] }] },
      signature: 'freebie|15|1',
    })
    expect(applied(state, hint).status).toBe('solved')
  })
})

describe('APPLY_HINT (eliminate)', () => {
  it('removes the digits from marks the player already wrote', () => {
    const start = withMarks(fresh(), { 0: [1, 2, 3, 4] })
    const hint = fakeHint({
      technique: 'cage-locks-line',
      apply: { kind: 'eliminate', cells: [{ cell: 0, digits: [3, 4] }] },
      signature: 'cage-locks-line|0|3,4',
    })
    const state = applied(start, hint)
    expect(state.marks[0]).toEqual([1, 2])
    expect(state.values[0]).toBeNull()
  })

  it('seeds a bare cell from `visible` first, so the elimination is visible', () => {
    const hint = fakeHint({
      technique: 'cage-locks-line',
      apply: {
        kind: 'eliminate',
        cells: [
          { cell: 0, digits: [3, 4] },
          { cell: 1, digits: [4] },
        ],
      },
      signature: 'cage-locks-line|0,1|3,4',
    })
    const visible: number[][] = Array.from({ length: 16 }, () => [1, 2, 3, 4])
    const state = applied(fresh(), hint, visible)
    expect(state.marks[0]).toEqual([1, 2])
    expect(state.marks[1]).toEqual([1, 2, 3])
  })

  it('never writes a value', () => {
    const hint = fakeHint({
      apply: { kind: 'eliminate', cells: [{ cell: 0, digits: [1] }] },
    })
    const state = applied(fresh(), hint, Array.from({ length: 16 }, () => [1, 2, 3, 4]))
    expect(state.values).toEqual(new Array(16).fill(null))
    expect(state.status).toBe('playing')
  })
})

describe('APPLY_HINT is one undo step', () => {
  it('a three-cell placement plus its mark cleanup undoes in a single Ctrl+Z', () => {
    const start = withMarks(fresh(), { 4: [1, 2], 8: [1, 2], 2: [1, 2] })
    const hint = fakeHint({
      apply: {
        kind: 'place',
        cells: [
          { cell: 0, value: 1 },
          { cell: 1, value: 2 },
          { cell: 5, value: 1 },
        ],
      },
      signature: 'single-cage-combination|0,1,5|1,2',
    })

    const after = applied(start, hint)
    expect(after.past).toHaveLength(1)
    expect(after.values[0]).toBe(1)
    expect(after.marks[4]).toEqual([2]) // cleaned by the 1 at cell 0

    const undone = gameReducer(after, { type: 'UNDO' })
    expect(undone.values).toEqual(start.values)
    expect(undone.marks).toEqual(start.marks)
    expect(undone.past).toHaveLength(0)

    const redone = gameReducer(undone, { type: 'REDO' })
    expect(redone.values).toEqual(after.values)
    expect(redone.marks).toEqual(after.marks)
  })

  it('an empty apply changes nothing and takes no history slot', () => {
    const start = shown(fresh(), fakeHint())
    const state = gameReducer(start, {
      type: 'APPLY_HINT',
      apply: { kind: 'place', cells: [] },
      visible: [],
      signature: 'noop',
    })
    expect(state.past).toEqual([])
    expect(state.recentHints).toEqual([])
    expect(state.hint).toEqual({ kind: 'idle' })
  })
})

describe('recentHints ring buffer', () => {
  it('remembers only the last three applied signatures', () => {
    let state = fresh()
    for (const cell of [0, 1, 2, 3]) {
      const hint = fakeHint({
        apply: { kind: 'place', cells: [{ cell, value: 1 }] },
        signature: 'sig-' + cell,
      })
      state = applied(state, hint)
    }
    expect(state.recentHints).toEqual(['sig-1', 'sig-2', 'sig-3'])
  })

  it('undo forgets the signature it just reverted, and redo remembers it again', () => {
    const hint = fakeHint()
    const after = applied(fresh(), hint)
    expect(after.recentHints).toEqual([hint.signature])

    const undone = gameReducer(after, { type: 'UNDO' })
    expect(undone.recentHints).toEqual([])

    const redone = gameReducer(undone, { type: 'REDO' })
    expect(redone.recentHints).toEqual([hint.signature])
  })

  it('undoing an ordinary edit leaves the ring buffer alone', () => {
    let state = applied(fresh(), fakeHint())
    state = gameReducer(state, { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    state = gameReducer(state, { type: 'UNDO' })
    expect(state.recentHints).toEqual(['freebie-cage|14|2'])
  })

  it('RESET and NEW_PUZZLE clear it', () => {
    const state = applied(fresh(), fakeHint())
    expect(gameReducer(state, { type: 'RESET' }).recentHints).toEqual([])
    expect(gameReducer(state, { type: 'NEW_PUZZLE', puzzle: SAMPLE_PUZZLE }).recentHints).toEqual(
      [],
    )
  })
})

describe('a pending hint is invalidated by anything that changes the grid', () => {
  function pending(): GameState {
    return shown(gameReducer(fresh(), { type: 'SELECT', index: 0 }), fakeHint())
  }

  it('a digit entry drops it', () => {
    expect(gameReducer(pending(), { type: 'DIGIT', value: 1 }).hint).toEqual({ kind: 'idle' })
  })

  it('a pencil mark drops it', () => {
    const marking = gameReducer(pending(), { type: 'SET_MODE', mode: 'mark' })
    expect(marking.hint.kind).toBe('shown') // switching mode alone is harmless
    expect(gameReducer(marking, { type: 'DIGIT', value: 1 }).hint).toEqual({ kind: 'idle' })
  })

  it('an erase drops it', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    state = shown(state, fakeHint())
    expect(gameReducer(state, { type: 'ERASE' }).hint).toEqual({ kind: 'idle' })
  })

  it('undo and redo drop it', () => {
    let state = gameReducer(fresh(), { type: 'SELECT', index: 0 })
    state = gameReducer(state, { type: 'DIGIT', value: 1 })
    state = shown(state, fakeHint())
    const undone = gameReducer(state, { type: 'UNDO' })
    expect(undone.hint).toEqual({ kind: 'idle' })
    expect(gameReducer(shown(undone, fakeHint()), { type: 'REDO' }).hint).toEqual({ kind: 'idle' })
  })

  it('reset and a new puzzle drop it', () => {
    expect(gameReducer(pending(), { type: 'RESET' }).hint).toEqual({ kind: 'idle' })
    expect(gameReducer(pending(), { type: 'NEW_PUZZLE', puzzle: SAMPLE_PUZZLE }).hint).toEqual({
      kind: 'idle',
    })
  })

  it('but moving the cursor around to look at the highlight does not', () => {
    const state = pending()
    expect(gameReducer(state, { type: 'SELECT', index: 9 }).hint.kind).toBe('shown')
    expect(gameReducer(state, { type: 'MOVE', direction: 'right' }).hint.kind).toBe('shown')
    expect(gameReducer(state, { type: 'TOGGLE_MODE' }).hint.kind).toBe('shown')
  })
})

describe('hintHighlight', () => {
  it('is the hint’s own highlight while one is shown', () => {
    const hint = fakeHint()
    expect(hintHighlight({ kind: 'shown', hint })).toBe(hint.highlight)
  })

  it('focuses the offending cells of a mistake and dims the rest', () => {
    const highlight = hintHighlight({
      kind: 'message',
      message: { kind: 'mistake', cells: [3, 7], text: 'x', secondary: 'y' },
    })
    expect(highlight).toEqual({
      focus: [3, 7],
      support: [],
      rows: [],
      cols: [],
      cages: [],
      dimRest: true,
      strike: [],
    })
  })

  it('is undefined when idle, stuck, or solved', () => {
    expect(hintHighlight({ kind: 'idle' })).toBeUndefined()
    expect(
      hintHighlight({ kind: 'message', message: { kind: 'stuck', text: 'x', secondary: 'y' } }),
    ).toBeUndefined()
    expect(
      hintHighlight({ kind: 'message', message: { kind: 'solved', text: 'x', secondary: 'y' } }),
    ).toBeUndefined()
  })
})

/* ------------------------------------------------------------------ */
/* The correctness check                                                */
/* ------------------------------------------------------------------ */

/** A board with cell 0 right and cell 1 wrong, already judged. */
function judged(): GameState {
  const wrong = SOLUTION[1] === 1 ? 2 : 1
  const state = enter(enter(fresh(), 0, SOLUTION[0] as number), 1, wrong)
  return gameReducer(state, {
    type: 'CHECK_CORRECTNESS',
    report: { correct: [0], incorrect: [1] },
  })
}

describe('CHECK_CORRECTNESS', () => {
  it('records the report and takes the board over from any hint on it', () => {
    const state = gameReducer(shown(fresh(), fakeHint()), {
      type: 'CHECK_CORRECTNESS',
      report: { correct: [0], incorrect: [1] },
    })
    expect(state.verdict).toEqual({ correct: [0], incorrect: [1] })
    expect(state.hint).toEqual({ kind: 'idle' })
  })

  it('is not an edit: nothing to undo, nothing changed on the grid', () => {
    const before = enter(fresh(), 0, 1)
    const after = gameReducer(before, {
      type: 'CHECK_CORRECTNESS',
      report: { correct: [0], incorrect: [] },
    })
    expect(after.past).toEqual(before.past)
    expect(after.values).toBe(before.values)
  })
})

/*
 * Two lifetimes, and the split is the point: green is a claim about the board
 * as it stood a moment ago, red is a claim about one cell.
 */
describe('the two halves of a verdict expire differently', () => {
  it('CLEAR_FEEDBACK drops the green and keeps the red', () => {
    const state = gameReducer(judged(), { type: 'CLEAR_FEEDBACK' })
    expect(state.verdict).toEqual({ correct: [], incorrect: [1] })
  })

  it('CLEAR_FEEDBACK with nothing to clear is a no-op', () => {
    const settled = gameReducer(judged(), { type: 'CLEAR_FEEDBACK' })
    expect(gameReducer(settled, { type: 'CLEAR_FEEDBACK' })).toBe(settled)

    const untouched = fresh()
    expect(gameReducer(untouched, { type: 'CLEAR_FEEDBACK' })).toBe(untouched)
  })

  it('red survives an edit to any cell but its own', () => {
    const elsewhere = enter(judged(), 5, 1)
    expect(elsewhere.verdict.incorrect).toEqual([1])

    const itsOwn = enter(judged(), 1, 3)
    expect(itsOwn.verdict.incorrect).toEqual([])
  })

  it('erasing the offending cell drops its red too', () => {
    const state = gameReducer(gameReducer(judged(), { type: 'SELECT', index: 1 }), {
      type: 'ERASE',
    })
    expect(state.verdict.incorrect).toEqual([])
  })

  it('any edit ends the green, wherever it lands', () => {
    expect(enter(judged(), 5, 1).verdict.correct).toEqual([])
  })

  /* A whole snapshot moved underneath, so the check is not about this board. */
  it('undo and redo drop the verdict entirely', () => {
    const undone = gameReducer(judged(), { type: 'UNDO' })
    expect(undone.verdict).toEqual({ correct: [], incorrect: [] })
    expect(gameReducer(undone, { type: 'REDO' }).verdict).toEqual({ correct: [], incorrect: [] })
  })

  it('reset and a new puzzle drop it as well', () => {
    expect(gameReducer(judged(), { type: 'RESET' }).verdict).toEqual({
      correct: [],
      incorrect: [],
    })
    expect(
      gameReducer(judged(), { type: 'NEW_PUZZLE', puzzle: SAMPLE_PUZZLE }).verdict,
    ).toEqual({ correct: [], incorrect: [] })
  })
})

describe('a hint-written placement is marked until the next move', () => {
  it('APPLY_HINT names the cells it filled', () => {
    expect(applied(fresh(), fakeHint()).placed).toEqual([14])
  })

  it('CLEAR_FEEDBACK strips the mark without touching the digit', () => {
    const state = gameReducer(applied(fresh(), fakeHint()), { type: 'CLEAR_FEEDBACK' })
    expect(state.placed).toEqual([])
    expect(state.values[14]).toBe(2)
  })

  it('placing says nothing about cells the check already called wrong', () => {
    const state = applied(judged(), fakeHint())
    expect(state.verdict).toEqual({ correct: [], incorrect: [1] })
  })

  /*
   * The Number choice has no technique to name, so it brings no signature and
   * the ring buffer stays truthful about what was actually applied.
   */
  it('an unsigned APPLY_HINT remembers nothing', () => {
    const state = gameReducer(fresh(), {
      type: 'APPLY_HINT',
      apply: { kind: 'place', cells: [{ cell: 14, value: 2 }] },
      visible: [],
    })
    expect(state.values[14]).toBe(2)
    expect(state.recentHints).toEqual([])
    expect(gameReducer(state, { type: 'UNDO' }).values[14]).toBeNull()
  })
})
