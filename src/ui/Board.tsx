import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { CellIndex, Grid, Puzzle } from '../engine/types'
import { cageAnchor, cageIdByCell, cageLabel, colOf, rowOf } from '../engine/types'
import type { GridErrors } from '../engine/errors'
import type { HintHighlight } from '../engine/hints'
import { edgeClassNames, computeCellEdges } from './cageBorders'
import { Cell } from './Cell'
import type { HintRole } from './Cell'
import type { Marks, Verdict } from '../game/state'
import './Board.css'

export interface BoardProps {
  puzzle: Puzzle
  values: Grid
  marks: Marks
  selected: CellIndex | null
  /**
   * Provably-wrong entries, from the engine's error checker. Derived state:
   * compute it with `useMemo` in the owner, never store it in the reducer.
   */
  errors?: GridErrors
  /**
   * What the hint currently on screen wants highlighted. Like `errors`, this is
   * derived: it comes straight off the pending hint and is turned into per-cell
   * roles here, so nothing about hint rendering is stored in the reducer.
   */
  highlight?: HintHighlight
  /**
   * What the hint panel's correctness check found. Stored state rather than
   * derived, unlike `errors`: it is what the board looked like when the player
   * asked, and it has to survive edits that would recompute a derived answer.
   */
  verdict?: Verdict
  /** Cells the panel's Number choice filled in. */
  placed?: readonly CellIndex[]
  onSelect: (index: CellIndex) => void
}

const NO_ERRORS: GridErrors = { cells: new Set(), duplicates: new Set(), badCages: [] }
const NO_VERDICT: Verdict = { correct: [], incorrect: [] }
const NOTHING_PLACED: readonly CellIndex[] = []

/** What one cell has to render from the highlight. */
interface CellHint {
  role?: HintRole
  strike?: number[]
  /** Outline classes for the sides of this cell that face out of its cage. */
  cageEdges: string
}

/**
 * The KenKen grid. Cage boundaries are derived purely from `cageIdByCell` —
 * a heavy border is drawn wherever two orthogonally-adjacent cells belong to
 * different cages (see `cageBorders.ts`), never hardcoded.
 */
export function Board({
  puzzle,
  values,
  marks,
  selected,
  errors = NO_ERRORS,
  highlight,
  verdict = NO_VERDICT,
  placed = NOTHING_PLACED,
  onSelect,
}: BoardProps) {
  const { size } = puzzle
  const cellCount = size * size

  const correct = useMemo(() => new Set(verdict.correct), [verdict])
  const incorrect = useMemo(() => new Set(verdict.incorrect), [verdict])
  const placedCells = useMemo(() => new Set(placed), [placed])

  const cageIds = useMemo(() => cageIdByCell(puzzle), [puzzle])

  const anchorLabels = useMemo(() => {
    const labels = new Map<CellIndex, string>()
    for (const cage of puzzle.cages) labels.set(cageAnchor(cage), cageLabel(cage))
    return labels
  }, [puzzle])

  const cageLabelByCell = useMemo(() => {
    const byCage = new Map(puzzle.cages.map((cage) => [cage.id, cageLabel(cage)]))
    return cageIds.map((id) => byCage.get(id) ?? '')
  }, [puzzle, cageIds])

  /**
   * The highlight, flattened to one entry per cell. Precedence per §5:
   * focus > support > row/column/cage band > dimmed.
   */
  const cellHints = useMemo<CellHint[] | null>(() => {
    if (!highlight) return null

    const focus = new Set(highlight.focus)
    const support = new Set(highlight.support)
    const rows = new Set(highlight.rows)
    const cols = new Set(highlight.cols)
    const cages = new Set(highlight.cages)
    const strikes = new Map(highlight.strike.map((s) => [s.cell, s.digits]))

    return Array.from({ length: cellCount }, (_, index) => {
      const row = rowOf(index, size)
      const col = colOf(index, size)
      const cage = cageIds[index]
      const inCage = cages.has(cage)

      let role: HintRole | undefined
      if (focus.has(index)) role = 'focus'
      else if (support.has(index)) role = 'support'
      else if (rows.has(row) || cols.has(col) || inCage) role = 'band'
      else if (highlight.dimRest) role = 'dim'

      // Outline only the sides that leave the cage, so the accent traces the
      // cage's silhouette instead of boxing in every cell of it.
      let cageEdges = ''
      if (inCage) {
        const classes = ['kk-cell--hint-cage']
        if (row === 0 || cageIds[index - size] !== cage) classes.push('kk-cell--hint-cage-t')
        if (col === size - 1 || cageIds[index + 1] !== cage) classes.push('kk-cell--hint-cage-r')
        if (row === size - 1 || cageIds[index + size] !== cage) classes.push('kk-cell--hint-cage-b')
        if (col === 0 || cageIds[index - 1] !== cage) classes.push('kk-cell--hint-cage-l')
        cageEdges = classes.join(' ')
      }

      return { role, strike: strikes.get(index), cageEdges }
    })
  }, [highlight, cageIds, size, cellCount])

  const selectedRow = selected != null ? rowOf(selected, size) : null
  const selectedCol = selected != null ? colOf(selected, size) : null
  const selectedCage = selected != null ? cageIds[selected] : null

  const errorCount = errors.cells.size

  return (
    <div className="kk-board-wrap">
      <div
        className="kk-board"
        role="grid"
        aria-label={`${size} by ${size} KenKen puzzle`}
        aria-rowcount={size}
        aria-colcount={size}
        style={{ '--size': size } as CSSProperties}
      >
        {Array.from({ length: cellCount }, (_, index) => {
          const row = rowOf(index, size)
          const col = colOf(index, size)
          const edges = computeCellEdges(puzzle, cageIds, index)
          const hint = cellHints?.[index]
          return (
            <Cell
              key={index}
              index={index}
              row={row}
              col={col}
              size={size}
              value={values[index]}
              marks={marks[index]}
              isSelected={selected === index}
              isInSelectedLine={
                selected != null &&
                selected !== index &&
                (row === selectedRow || col === selectedCol)
              }
              isInSelectedCage={
                selected != null && selected !== index && cageIds[index] === selectedCage
              }
              isError={errors.cells.has(index)}
              isCorrect={correct.has(index)}
              isIncorrect={incorrect.has(index)}
              isPlaced={placedCells.has(index)}
              hintRole={hint?.role}
              strikeDigits={hint?.strike}
              hintCageEdges={hint?.cageEdges}
              cageLabelText={cageLabelByCell[index]}
              showCageLabel={anchorLabels.has(index)}
              edgeClassName={edgeClassNames(edges)}
              onSelect={onSelect}
            />
          )
        })}
      </div>

      {/*
        A live region rather than `role="status"`: the app already uses
        `role="status"` for the loading and win messages, and keeping this one
        role-less means a screen reader hears the conflict count without those
        three announcements competing for the same landmark.
      */}
      <div className="kk-board__errors" aria-live="polite" aria-atomic="true">
        {errorCount > 0 && `${errorCount} ${errorCount === 1 ? 'cell conflicts' : 'cells conflict'}`}
      </div>
    </div>
  )
}
