import type { CellIndex, Puzzle } from '../engine/types'
import { colOf, indexOf, rowOf } from '../engine/types'

/**
 * Per-cell border info for rendering cage boundaries.
 *
 * Only the right and bottom edges are ever drawn by a cell: the outer frame
 * of the board is drawn by the board container itself, and every internal
 * boundary is drawn exactly once (by the cell above/left of it) rather than
 * by both neighbours, so heavy cage lines never come out doubled.
 */
export interface CellEdges {
  /** Draw a heavy border on the right (a cage boundary, not the grid edge). */
  rightHeavy: boolean
  /** Draw a heavy border on the bottom (a cage boundary, not the grid edge). */
  bottomHeavy: boolean
  /** Right-most column: no right border is drawn (the board frame covers it). */
  isLastCol: boolean
  /** Bottom-most row: no bottom border is drawn (the board frame covers it). */
  isLastRow: boolean
}

/**
 * Compute which edges of `index` sit on a cage boundary, by comparing its
 * cage id (from `cageIdByCell`) against its right and bottom neighbours.
 */
export function computeCellEdges(
  puzzle: Puzzle,
  cageIds: readonly number[],
  index: CellIndex,
): CellEdges {
  const { size } = puzzle
  const row = rowOf(index, size)
  const col = colOf(index, size)
  const isLastCol = col === size - 1
  const isLastRow = row === size - 1

  const rightHeavy = !isLastCol && cageIds[index] !== cageIds[indexOf(row, col + 1, size)]
  const bottomHeavy = !isLastRow && cageIds[index] !== cageIds[indexOf(row + 1, col, size)]

  return { rightHeavy, bottomHeavy, isLastCol, isLastRow }
}

/** CSS class names to apply for a cell's computed edges (see `Board.css`). */
export function edgeClassNames(edges: CellEdges): string {
  const classes: string[] = []
  if (edges.isLastCol) classes.push('kk-cell--edge-r')
  else if (edges.rightHeavy) classes.push('kk-cell--cage-r')
  if (edges.isLastRow) classes.push('kk-cell--edge-b')
  else if (edges.bottomHeavy) classes.push('kk-cell--cage-b')
  return classes.join(' ')
}
