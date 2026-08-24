import type { CorrectnessReport, Hint, HintApply, HintHighlight, HintResult } from '../engine/hints'
import type { CellIndex, Grid, Puzzle } from '../engine/types'

/** Whether digit input writes a value into the cell or toggles a pencil mark. */
export type Mode = 'value' | 'mark'

/** The non-hint outcomes of a hint request: solved, mistake, or stuck. */
export type HintMessage = Exclude<HintResult, { kind: 'hint' }>

/**
 * What the hint panel is explaining, and what the board draws underneath it.
 * Ephemeral UI state like `selected`: it lives in `GameState` but never in a
 * `HistorySnapshot`.
 *
 * No arm means "armed". Explaining and writing are two separate choices in the
 * panel now, so `shown` says only that these words are on screen and this
 * highlight is on the board — nothing is queued behind it, which is why
 * dropping the phase can never lose the player anything.
 */
export type HintPhase =
  | { kind: 'idle' }
  | { kind: 'shown'; hint: Hint }
  | { kind: 'message'; message: HintMessage }

const IDLE_HINT: HintPhase = { kind: 'idle' }

/**
 * The cells the panel's Correctness check rejected. Ephemeral like `hint` — it
 * is a photograph of one moment, not a fact about the grid — so it is stored
 * here and never in a `HistorySnapshot`.
 *
 * The wrong cells only. The check used to record the confirmed ones too and
 * ring them green, which was the app taking a bow for work the player did; the
 * only news a check has is what is wrong. What is left is the half that had to
 * be stored anyway, because its expiry is not a function of the board: a
 * rejected cell holds its mark until that cell is edited, since a player who
 * has been told they are wrong has to still be told it while they fix it.
 */
export type Verdict = readonly CellIndex[]

const NO_VERDICT: Verdict = []
const NOTHING_PLACED: readonly CellIndex[] = []

/**
 * The verdict on every cell except the one just edited, which has outrun
 * whatever the check said about it.
 *
 * Returns the same array when the cell was not in it, so an edit anywhere else
 * on the board leaves the identity `Board` memoizes against untouched.
 */
function afterEdit(verdict: Verdict, cell: CellIndex): Verdict {
  return verdict.includes(cell) ? verdict.filter((c) => c !== cell) : verdict
}

/** How many applied-hint signatures `recentHints` remembers. See §6.3. */
export const RECENT_HINT_LIMIT = 3

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
  /** What the hint panel is explaining. Never travels through undo/redo. */
  hint: HintPhase
  /** The last Correctness check, or two empty lists. Never travels through undo/redo. */
  verdict: Verdict
  /**
   * Cells the panel's Number choice wrote for the player. The values are
   * ordinary entries; only their ink is special, and only until the player's
   * next move.
   */
  placed: readonly CellIndex[]
  /** Ring buffer of the last `RECENT_HINT_LIMIT` applied hint signatures. */
  recentHints: string[]
  /**
   * Whether entering a value also strips that digit from the pencil marks of
   * the cell's row and column peers. This is a preference rather than board
   * state, so like `selected` and `mode` it deliberately stays out of
   * `HistorySnapshot`: undoing a sweep brings the marks back while the setting
   * itself remains on.
   */
  autoClearMarks: boolean
}

/** The portion of state that undo/redo travels through. Selection and mode are excluded. */
interface HistorySnapshot {
  values: Grid
  marks: Marks
  status: Status
  /**
   * Set when the edit separating this snapshot from the live state was an
   * `APPLY_HINT`. On a `past` entry that edit runs forwards, on a `future`
   * entry it runs backwards; either way it lets `UNDO`/`REDO` keep
   * `recentHints` in step with what is actually on the board (§7.3).
   */
  hintSignature?: string
}

export type GameAction =
  | { type: 'SELECT'; index: CellIndex }
  | { type: 'MOVE'; direction: Direction }
  | { type: 'DIGIT'; value: number }
  | { type: 'ERASE' }
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'TOGGLE_MODE' }
  | { type: 'SET_AUTO_CLEAR_MARKS'; enabled: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' }
  | { type: 'NEW_PUZZLE'; puzzle: Puzzle }
  | { type: 'REQUEST_HINT'; result: HintResult }
  /**
   * `signature` is optional because the panel's Number choice has none to give:
   * `findNextNumber` may walk several eliminations past the hint the player
   * would have been shown, so there is no single technique to remember. A
   * made-up one would sit in `recentHints` matching nothing and suppressing
   * nothing, which is worse than an honest gap.
   */
  | { type: 'APPLY_HINT'; apply: HintApply; visible: number[][]; signature?: string }
  | { type: 'CHECK_CORRECTNESS'; report: CorrectnessReport }
  | { type: 'CLEAR_FEEDBACK' }
  | { type: 'DISMISS_HINT' }

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

export function createInitialState(puzzle: Puzzle, autoClearMarks = true): GameState {
  return {
    puzzle,
    values: emptyValues(puzzle.size),
    marks: emptyMarks(puzzle.size),
    selected: null,
    mode: 'value',
    status: 'playing',
    past: [],
    future: [],
    hint: IDLE_HINT,
    verdict: NO_VERDICT,
    placed: NOTHING_PLACED,
    recentHints: [],
    autoClearMarks,
  }
}

function snapshot(state: GameState): HistorySnapshot {
  return { values: state.values, marks: state.marks, status: state.status }
}

/**
 * The fields a snapshot restores. Spelled out rather than spread so
 * `hintSignature` — bookkeeping that belongs to the history entry, not to the
 * game — never leaks into `GameState`.
 */
function restore(snap: HistorySnapshot): Pick<GameState, 'values' | 'marks' | 'status'> {
  return { values: snap.values, marks: snap.marks, status: snap.status }
}

/** Push the current mutable state onto the undo stack and clear the redo stack. */
function pushHistory(state: GameState, hintSignature?: string): Pick<GameState, 'past' | 'future'> {
  return { past: [...state.past, { ...snapshot(state), hintSignature }], future: [] }
}

function pushSignature(recent: readonly string[], signature: string): string[] {
  return [...recent, signature].slice(-RECENT_HINT_LIMIT)
}

/** Drop the most recent occurrence of `signature`, so undo un-remembers it. */
function popSignature(recent: readonly string[], signature: string): string[] {
  const at = recent.lastIndexOf(signature)
  if (at === -1) return [...recent]
  return [...recent.slice(0, at), ...recent.slice(at + 1)]
}

/** Row and column peers of `cell`, excluding `cell` itself. */
function peersOf(cell: CellIndex, size: number): CellIndex[] {
  const row = Math.floor(cell / size)
  const col = cell % size
  const peers: CellIndex[] = []
  for (let c = 0; c < size; c++) if (c !== col) peers.push(row * size + c)
  for (let r = 0; r < size; r++) if (r !== row) peers.push(r * size + col)
  return peers
}

/**
 * Drop `value` from the pencil marks of `cell`'s row and column peers, and
 * report whether anything was actually there to drop. Cages are left alone on
 * purpose: a digit may legally repeat inside a cage, so only the line
 * constraints justify erasing a player's mark. `marks` must already be a copy;
 * the entries themselves are replaced rather than mutated.
 */
function clearPeerMarks(marks: Marks, cell: CellIndex, value: number, size: number): boolean {
  let cleared = false
  for (const peer of peersOf(cell, size)) {
    if (marks[peer].includes(value)) {
      marks[peer] = marks[peer].filter((d) => d !== value)
      cleared = true
    }
  }
  return cleared
}

/**
 * The highlight a hint phase asks the board to draw, or `undefined` for none.
 *
 * A `mistake` message carries cells but no highlight of its own, so one is
 * synthesised here: focus the offending cells and dim everything else, exactly
 * as §8.2 specifies.
 */
export function hintHighlight(phase: HintPhase): HintHighlight | undefined {
  if (phase.kind === 'shown') return phase.hint.highlight
  if (phase.kind === 'message' && phase.message.kind === 'mistake') {
    if (phase.message.cells.length === 0) return undefined
    return {
      focus: [...phase.message.cells],
      support: [],
      rows: [],
      cols: [],
      cages: [],
      dimRest: true,
      strike: [],
    }
  }
  return undefined
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
      const judged = { verdict: afterEdit(state.verdict, selected), placed: NOTHING_PLACED }

      if (state.mode === 'value') {
        const values = state.values.slice()
        values[selected] = value
        const marks = state.marks.slice()
        marks[selected] = []
        // Same `pushHistory` step as the value itself, so one undo takes back
        // the entry and the peer cleanup together.
        if (state.autoClearMarks) clearPeerMarks(marks, selected, value, state.puzzle.size)
        const status: Status = isGridSolved(state.puzzle, values) ? 'solved' : 'playing'
        return { ...state, ...history, ...judged, values, marks, status, hint: IDLE_HINT }
      }

      // mark mode: only pencil-mark empty cells
      if (state.values[selected] != null) return state
      const marks = state.marks.slice()
      marks[selected] = toggleMark(marks[selected], value)
      return { ...state, ...history, ...judged, marks, hint: IDLE_HINT }
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
      return {
        ...state,
        ...history,
        values,
        marks,
        status,
        hint: IDLE_HINT,
        verdict: afterEdit(state.verdict, selected),
        placed: NOTHING_PLACED,
      }
    }

    case 'SET_MODE':
      return { ...state, mode: action.mode }

    case 'TOGGLE_MODE':
      return { ...state, mode: state.mode === 'value' ? 'mark' : 'value' }

    /*
     * Switching the preference on catches the board up with what it would have
     * looked like had it been on all along, in one undoable step. Switching it
     * off only stops future cleanups — marks already cleared stay cleared,
     * since the player can always undo or write them back by hand.
     */
    case 'SET_AUTO_CLEAR_MARKS': {
      if (action.enabled === state.autoClearMarks) return state
      if (!action.enabled) return { ...state, autoClearMarks: false }

      const marks = state.marks.slice()
      let cleared = false
      for (let cell = 0; cell < state.values.length; cell++) {
        const value = state.values[cell]
        if (value == null) continue
        if (clearPeerMarks(marks, cell, value, state.puzzle.size)) cleared = true
      }
      // A sweep with nothing to clean must not leave a dead undo entry behind.
      if (!cleared) return { ...state, autoClearMarks: true }
      return { ...state, ...pushHistory(state), marks, autoClearMarks: true, hint: IDLE_HINT }
    }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const prev = state.past[state.past.length - 1]
      const past = state.past.slice(0, -1)
      const future = [...state.future, { ...snapshot(state), hintSignature: prev.hintSignature }]
      const recentHints = prev.hintSignature
        ? popSignature(state.recentHints, prev.hintSignature)
        : state.recentHints
      // A whole snapshot moved under it, so nothing the check said still names
      // the board it was looking at — red included.
      return {
        ...state,
        ...restore(prev),
        past,
        future,
        recentHints,
        hint: IDLE_HINT,
        verdict: NO_VERDICT,
        placed: NOTHING_PLACED,
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[state.future.length - 1]
      const future = state.future.slice(0, -1)
      const past = [...state.past, { ...snapshot(state), hintSignature: next.hintSignature }]
      const recentHints = next.hintSignature
        ? pushSignature(state.recentHints, next.hintSignature)
        : state.recentHints
      return {
        ...state,
        ...restore(next),
        past,
        future,
        recentHints,
        hint: IDLE_HINT,
        verdict: NO_VERDICT,
        placed: NOTHING_PLACED,
      }
    }

    case 'RESET': {
      const history = pushHistory(state)
      return {
        ...state,
        ...history,
        values: emptyValues(state.puzzle.size),
        marks: emptyMarks(state.puzzle.size),
        status: 'playing',
        hint: IDLE_HINT,
        verdict: NO_VERDICT,
        placed: NOTHING_PLACED,
        recentHints: [],
      }
    }

    case 'NEW_PUZZLE':
      return createInitialState(action.puzzle, state.autoClearMarks)

    case 'REQUEST_HINT': {
      const { result } = action
      return {
        ...state,
        hint:
          result.kind === 'hint'
            ? { kind: 'shown', hint: result.hint }
            : { kind: 'message', message: result },
      }
    }

    /*
     * Everything the hint writes — values, the placed cells' own marks, and the
     * peer mark cleanup a player would do by hand — happens against one
     * `pushHistory`, so the whole hint is a single undo step no matter how many
     * cells it touches.
     */
    case 'APPLY_HINT': {
      const { apply, visible, signature } = action
      if (apply.cells.length === 0) return { ...state, hint: IDLE_HINT }
      const history = pushHistory(state, signature)
      const recentHints = signature
        ? pushSignature(state.recentHints, signature)
        : state.recentHints
      const size = state.puzzle.size

      if (apply.kind === 'place') {
        const values = state.values.slice()
        const marks = state.marks.slice()
        for (const { cell, value } of apply.cells) {
          values[cell] = value
          marks[cell] = []
        }
        // Never gated on `autoClearMarks`: a hint teaches the bookkeeping that
        // goes with a placement whether or not the player has it automated.
        for (const { cell, value } of apply.cells) clearPeerMarks(marks, cell, value, size)
        const status: Status = isGridSolved(state.puzzle, values) ? 'solved' : 'playing'
        return {
          ...state,
          ...history,
          values,
          marks,
          status,
          recentHints,
          hint: IDLE_HINT,
          placed: apply.cells.map((entry) => entry.cell),
        }
      }

      // An elimination on a bare cell would otherwise change nothing the player
      // can see, so seed the cell with what they could already work out first.
      const marks = state.marks.slice()
      for (const { cell, digits } of apply.cells) {
        const base = marks[cell].length > 0 ? marks[cell] : (visible[cell] ?? [])
        marks[cell] = base.filter((d) => !digits.includes(d)).sort((a, b) => a - b)
      }
      return {
        ...state,
        ...history,
        marks,
        recentHints,
        hint: IDLE_HINT,
        placed: NOTHING_PLACED,
      }
    }

    /*
     * The check speaks about the whole board at once, so it takes the board
     * over from whatever the panel was explaining: a hint's dim and rings would
     * only argue with the verdict now painted over the same cells.
     */
    case 'CHECK_CORRECTNESS':
      return {
        ...state,
        hint: IDLE_HINT,
        verdict: action.report.incorrect,
        placed: NOTHING_PLACED,
      }

    /*
     * The player's next move, whatever it was. Only the hint-placed mark expires
     * this way — it is a claim about the board as it stood a moment ago. The
     * verdict is a claim about particular cells and is dropped by each cell's
     * own edit instead, in `afterEdit`.
     */
    case 'CLEAR_FEEDBACK': {
      if (state.placed.length === 0) return state
      return { ...state, placed: NOTHING_PLACED }
    }

    case 'DISMISS_HINT':
      return state.hint.kind === 'idle' ? state : { ...state, hint: IDLE_HINT }

    default:
      return state
  }
}
