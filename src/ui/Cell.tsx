import type { CellIndex } from '../engine/types'
import './Cell.css'

/**
 * This cell's part in the hint currently on screen, strongest first
 * (docs/HINTS.md §5): it carries the conclusion, supplies the reason, sits in a
 * highlighted row/column/cage, or is dimmed out of the way.
 */
export type HintRole = 'focus' | 'support' | 'band' | 'dim'

const NO_STRIKE: readonly number[] = []

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
  /** This entry is provably wrong — see `createErrorChecker` in the engine. */
  isError: boolean
  /**
   * The last correctness check rejected this entry. A weaker claim than
   * `isError`: a conflict is impossible under any solution, while this is only
   * not *the* answer — so it wears a mark of its own rather than the conflict's,
   * and holds until the cell is edited.
   */
  isIncorrect?: boolean
  /** The panel's Number choice wrote this entry. Transient, like `isCorrect`. */
  isPlaced?: boolean
  /** Derived in `Board` from the hint's `HintHighlight`; absent when no hint is shown. */
  hintRole?: HintRole
  /** Pencil digits this hint rules out, drawn struck through. */
  strikeDigits?: readonly number[]
  /** Accent-outline classes for a highlighted cage's outer edges, from `Board`. */
  hintCageEdges?: string
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
  isError,
  isIncorrect = false,
  isPlaced = false,
  hintRole,
  strikeDigits = NO_STRIKE,
  hintCageEdges,
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
  // Hint roles and errors are additive rather than exclusive: a selected cell
  // that is also wrong, or a focused cell the player has selected, has to read
  // as both, so the classes coexist and the stylesheet decides what wins.
  if (hintRole) classNames.push(`kk-cell--hint-${hintRole}`)
  if (hintCageEdges) classNames.push(hintCageEdges)
  if (isPlaced) classNames.push('kk-cell--placed')
  if (isIncorrect) classNames.push('kk-cell--incorrect')
  if (isError) classNames.push('kk-cell--error')

  const status = value != null ? `value ${value}` : 'empty'
  // Colour alone must not carry the highlight, so the role is named in the
  // accessible name too (§5).
  const hintNote =
    hintRole === 'focus' ? ', hint focus' : hintRole === 'support' ? ', hint context' : ''
  /*
   * Both marks are red, and one cell can carry both, so the words are what
   * separate them for a reader who cannot see the shapes (§9). `conflict` is
   * the stronger claim — it holds against every solution — and is the one worth
   * saying when a cell is both.
   */
  const checkNote = isError ? ', conflict' : isIncorrect ? ', incorrect' : ''
  const ariaLabel =
    `Row ${row + 1}, column ${col + 1}, cage ${cageLabelText}, ${status}` +
    checkNote +
    (isPlaced ? ', filled in for you' : '') +
    hintNote

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
          {Array.from({ length: size }, (_, i) => i + 1).map((digit) => {
            const written = marks.includes(digit)
            // Only a digit the player can actually see can be struck through.
            const struck = written && strikeDigits.includes(digit)
            return (
              <span
                key={digit}
                className={struck ? 'kk-cell__mark kk-cell__mark--struck' : 'kk-cell__mark'}
              >
                {written ? digit : ''}
              </span>
            )
          })}
        </span>
      )}
    </button>
  )
}
