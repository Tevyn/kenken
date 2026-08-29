import type { CellIndex, Grid, Puzzle } from '../engine/types';
import type { Marks } from './state';

/** Shared empty result, so a cell with no wrong note keeps a stable identity. */
const NONE: readonly number[] = [];

/**
 * The pencil-mark digits that provably cannot go where they are written: a note
 * for a digit that a peer in the same row or column has already been given.
 *
 * This is the note-side twin of the value duplicate check in `errors.ts` — a
 * digit can legally repeat inside a cage but never within a line, so a line peer
 * holding the digit is the one placement a note can be caught out by from the
 * board alone. `puzzle.solution` is never consulted: a note that merely differs
 * from the intended answer is still a candidate the player is entitled to keep,
 * so only a line contradiction reddens it.
 *
 * Purely derived, exactly like `errors` and `completedDigits`: compute it with
 * `useMemo` in the owner and never store it in the reducer. Returns one entry
 * per cell (empty where nothing is wrong), position-aligned with `marks`.
 */
export function wrongNotes(puzzle: Puzzle, values: Grid, marks: Marks): (readonly number[])[] {
  const { size } = puzzle;

  // The digits already placed in each row and each column.
  const rowDigits = Array.from({ length: size }, () => new Set<number>());
  const colDigits = Array.from({ length: size }, () => new Set<number>());
  for (let cell = 0; cell < values.length; cell++) {
    const value = values[cell];
    if (value == null) continue;
    rowDigits[Math.floor(cell / size)].add(value);
    colDigits[cell % size].add(value);
  }

  return marks.map((cellMarks: readonly number[], cell: CellIndex) => {
    if (cellMarks.length === 0) return NONE;
    const inRow = rowDigits[Math.floor(cell / size)];
    const inCol = colDigits[cell % size];
    const wrong = cellMarks.filter((digit) => inRow.has(digit) || inCol.has(digit));
    return wrong.length > 0 ? wrong : NONE;
  });
}
