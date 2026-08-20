import type { CellIndex } from '../engine/types'
import './Cell.css'

export interface CellProps {
  index: CellIndex
  row: number
  col: number
  size: number
  value: number | null
  marks: readonly number[]
  isSelected: boolean
  isInSelectedLine: boolean
  isInSelectedCage: boolean
  /** Cage label text, e.g. "12+" — always used for the accessible name. */
  cageLabelText: string
  /** Only the cage's anchor cell renders the label visually. */
  showCageLabel: boolean
  /** Space-separated edge classes from `edgeClassNames` (see `cageBorders.ts`). */
  edgeClassName: string
  onSelect: (index: CellIndex) => void
}

/** One cell of the KenKen board: a large centred value, or a grid of pencil marks. */
export function Cell({
  index,
  row,
  col,
  size,
  value,
  marks,
  isSelected,
  isInSelectedLine,
  isInSelectedCage,
  cageLabelText,
  showCageLabel,
  edgeClassName,
  onSelect,
}: CellProps) {
  const classNames = ['kk-cell']
  if (edgeClassName) classNames.push(edgeClassName)
  if (isSelected) classNames.push('kk-cell--selected')
  else if (isInSelectedCage) classNames.push('kk-cell--cage-highlight')
  else if (isInSelectedLine) classNames.push('kk-cell--line-highlight')

  const status = value != null ? `value ${value}` : 'empty'
  const ariaLabel = `Row ${row + 1}, column ${col + 1}, cage ${cageLabelText}, ${status}`

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={isSelected}
      aria-rowindex={row + 1}
      aria-colindex={col + 1}
      aria-label={ariaLabel}
      className={classNames.join(' ')}
      onClick={() => onSelect(index)}
    >
      {showCageLabel && <span className="kk-cell__cage-label">{cageLabelText}</span>}
      {value != null ? (
        <span className="kk-cell__value">{value}</span>
      ) : (
        <span className="kk-cell__marks" aria-hidden="true">
          {Array.from({ length: size }, (_, i) => i + 1).map((digit) => (
            <span key={digit} className="kk-cell__mark">
              {marks.includes(digit) ? digit : ''}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}
