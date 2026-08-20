import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { CellIndex, Grid, Puzzle } from '../engine/types'
import { cageAnchor, cageIdByCell, cageLabel, colOf, rowOf } from '../engine/types'
import { edgeClassNames, computeCellEdges } from './cageBorders'
import { Cell } from './Cell'
import type { Marks } from '../game/state'
import './Board.css'

export interface BoardProps {
  puzzle: Puzzle
  values: Grid
  marks: Marks
  selected: CellIndex | null
  onSelect: (index: CellIndex) => void
}

/**
 * The KenKen grid. Cage boundaries are derived purely from `cageIdByCell` —
 * a heavy border is drawn wherever two orthogonally-adjacent cells belong to
 * different cages (see `cageBorders.ts`), never hardcoded.
 */
export function Board({ puzzle, values, marks, selected, onSelect }: BoardProps) {
  const { size } = puzzle

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

  const selectedRow = selected != null ? rowOf(selected, size) : null
  const selectedCol = selected != null ? colOf(selected, size) : null
  const selectedCage = selected != null ? cageIds[selected] : null

  const cellCount = size * size

  return (
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
              selected != null && selected !== index && (row === selectedRow || col === selectedCol)
            }
            isInSelectedCage={
              selected != null && selected !== index && cageIds[index] === selectedCage
            }
            cageLabelText={cageLabelByCell[index]}
            showCageLabel={anchorLabels.has(index)}
            edgeClassName={edgeClassNames(edges)}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}
