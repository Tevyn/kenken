import type { GridErrors } from '../engine/errors';
import type { CellIndex, Grid, Puzzle } from '../engine/types';
import type { Verdict } from './state';

/**
 * The digits that are fully and cleanly placed. A size-N puzzle holds exactly N
 * of each digit in its solution, so a digit with N copies on the board and no
 * red mark on any of them is done — every row and column already has it, and
 * there is nowhere left to put another. Those are the digit-pad keys that go
 * inactive (see `Keypad`).
 *
 * "Red" is the same union the board paints and the completion glow reads (see
 * `cleanCompleteUnits`): a provable conflict (`errors.cells`) or a cell the
 * Correctness check rejected (`verdict`). A red copy never counts toward the N,
 * so a digit is never retired while any instance of it is still in question — a
 * duplicate marks both copies red, dropping the clean count back below N.
 *
 * Purely derived, exactly like `errors`: compute it with `useMemo` in the owner
 * and never store it in the reducer.
 */
export function completedDigits(
  puzzle: Puzzle,
  values: Grid,
  errors: GridErrors,
  verdict: Verdict,
): Set<number> {
  const { size } = puzzle;
  const verdictSet = verdict.length > 0 ? new Set(verdict) : null;
  const isRed = (cell: CellIndex) => errors.cells.has(cell) || (verdictSet?.has(cell) ?? false);

  const counts = new Array<number>(size + 1).fill(0);
  for (let cell = 0; cell < values.length; cell++) {
    const value = values[cell];
    if (value == null || value < 1 || value > size) continue;
    if (isRed(cell)) continue;
    counts[value]++;
  }

  const complete = new Set<number>();
  for (let digit = 1; digit <= size; digit++) if (counts[digit] === size) complete.add(digit);
  return complete;
}
