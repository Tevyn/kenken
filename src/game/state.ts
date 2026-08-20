import type { CellIndex, Grid, Puzzle } from '../engine/types'

/** Whether digit input writes a value into the cell or toggles a pencil mark. */
export type Mode = 'value' | 'mark'

/** Coarse game status. `'solved'` once the grid matches the puzzle's solution. */
export type Status = 'playing' | 'solved'

/** Arrow-key direction for selection movement. */
export type Direction = 'up' | 'down' | 'left' | 'right'

/** Pencil marks per cell: sorted, de-duplicated candidate digits. */
export type Marks = number[][]

export interface GameState {
  puzzle: Puzzle
  values: Grid
  marks: Marks
  selected: CellIndex | null
  mode: Mode
  status: Status
  /** Undo stack: snapshots taken immediately before each mutating action. */
  past: HistorySnapshot[]
  /** Redo stack: snapshots popped off `past` by `UNDO`, most recent last. */
  future: HistorySnapshot[]
}

/** The portion of state that undo/redo travels through. Selection and mode are excluded. */
interface HistorySnapshot {
  values: Grid
  marks: Marks
  status: Status
}

export type GameAction =
  | { type: 'SELECT'; index: CellIndex }
  | { type: 'MOVE'; direction: Direction }
  | { type: 'DIGIT'; value: number }
  | { type: 'ERASE' }
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'TOGGLE_MODE' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' }
  | { type: 'NEW_PUZZLE'; puzzle: Puzzle }

/** True once every cell is filled and matches the puzzle's unique solution. */
export function isGridSolved(puzzle: Puzzle, values: Grid): boolean {
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null || values[i] !== puzzle.solution[i]) return false
  }
  return true
}

function emptyMarks(size: number): Marks {
  return Array.from({ length: size * size }, () => [])
}

function emptyValues(size: number): Grid {
  return new Array<number | null>(size * size).fill(null)
}

export function createInitialState(puzzle: Puzzle): GameState {
  return {
    puzzle,
    values: emptyValues(puzzle.size),
    marks: emptyMarks(puzzle.size),
    selected: null,
    mode: 'value',
    status: 'playing',
    past: [],
    future: [],
  }
}

function snapshot(state: GameState): HistorySnapshot {
  return { values: state.values, marks: state.marks, status: state.status }
}

/** Push the current mutable state onto the undo stack and clear the redo stack. */
function pushHistory(state: GameState): Pick<GameState, 'past' | 'future'> {
  return { past: [...state.past, snapshot(state)], future: [] }
}

function toggleMark(marks: number[], value: number): number[] {
  return marks.includes(value)
    ? marks.filter((m) => m !== value)
    : [...marks, value].sort((a, b) => a - b)
}

function moveIndex(index: CellIndex, direction: Direction, size: number): CellIndex {
  const row = Math.floor(index / size)
  const col = index % size
  switch (direction) {
    case 'up':
      return row > 0 ? index - size : index
    case 'down':
      return row < size - 1 ? index + size : index
    case 'left':
      return col > 0 ? index - 1 : index
    case 'right':
      return col < size - 1 ? index + 1 : index
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT': {
      if (action.index < 0 || action.index >= state.values.length) return state
      return { ...state, selected: action.index }
    }

    case 'MOVE': {
      const from = state.selected ?? 0
      const next = moveIndex(from, action.direction, state.puzzle.size)
      return { ...state, selected: next }
    }

    case 'DIGIT': {
      if (state.selected == null) return state
      const { value } = action
      if (value < 1 || value > state.puzzle.size) return state
      const selected = state.selected
      const history = pushHistory(state)

      if (state.mode === 'value') {
        const values = state.values.slice()
        values[selected] = value
        const marks = state.marks.slice()
        marks[selected] = []
        const status: Status = isGridSolved(state.puzzle, values) ? 'solved' : 'playing'
        return { ...state, ...history, values, marks, status }
      }

      // mark mode: only pencil-mark empty cells
      if (state.values[selected] != null) return state
      const marks = state.marks.slice()
      marks[selected] = toggleMark(marks[selected], value)
      return { ...state, ...history, marks }
    }

    case 'ERASE': {
      if (state.selected == null) return state
      const selected = state.selected
      if (state.values[selected] == null && state.marks[selected].length === 0) return state
      const history = pushHistory(state)
      const values = state.values.slice()
      values[selected] = null
      const marks = state.marks.slice()
      marks[selected] = []
      const status: Status = isGridSolved(state.puzzle, values) ? 'solved' : 'playing'
      return { ...state, ...history, values, marks, status }
    }

    case 'SET_MODE':
      return { ...state, mode: action.mode }

    case 'TOGGLE_MODE':
      return { ...state, mode: state.mode === 'value' ? 'mark' : 'value' }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const prev = state.past[state.past.length - 1]
      const past = state.past.slice(0, -1)
      const future = [...state.future, snapshot(state)]
      return { ...state, ...prev, past, future }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[state.future.length - 1]
      const future = state.future.slice(0, -1)
      const past = [...state.past, snapshot(state)]
      return { ...state, ...next, past, future }
    }

    case 'RESET': {
      const history = pushHistory(state)
      return {
        ...state,
        ...history,
        values: emptyValues(state.puzzle.size),
        marks: emptyMarks(state.puzzle.size),
        status: 'playing',
      }
    }

    case 'NEW_PUZZLE':
      return createInitialState(action.puzzle)

    default:
      return state
  }
}
