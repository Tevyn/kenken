/**
 * Shared type contract for the KenKen engine.
 *
 * Cells are addressed by a flat index: `index = row * size + col`.
 * Values are 1..size. `null` means empty.
 */

/** Grid sizes the app supports. */
export const MIN_SIZE = 3;
export const MAX_SIZE = 9;

/**
 * Cage operator.
 * `'='` marks a single-cell "freebie" cage whose target is simply the value.
 */
export type Op = '+' | '-' | '*' | '/' | '=';

export const OPS: readonly Op[] = ['+', '-', '*', '/', '='] as const;

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'expert'] as const;

/** A flat cell index in `0 .. size*size - 1`. */
export type CellIndex = number;

export interface Cage {
  /** Stable id, unique within a puzzle. Also the index into `Puzzle.cages`. */
  id: number;
  /** Flat cell indices, sorted ascending. Always orthogonally connected. */
  cells: CellIndex[];
  op: Op;
  /** For `'='` cages this equals the single cell's solution value. */
  target: number;
}

export interface Puzzle {
  /** Grid order, 3..9. */
  size: number;
  difficulty: Difficulty;
  cages: Cage[];
  /**
   * The unique solution, length `size * size`, values 1..size.
   * Generation guarantees no other grid satisfies the cages.
   */
  solution: number[];
  /** Seed used to generate this puzzle; regenerating with it reproduces the puzzle. */
  seed: string;
}

/** Options accepted by `generatePuzzle`. */
export interface GenerateOptions {
  size: number;
  difficulty: Difficulty;
  /** Omit for a random seed. */
  seed?: string;
}

/** A grid of user entries; `null` = empty. Length `size * size`. */
export type Grid = (number | null)[];

/** Row/column coordinate helpers. */
export const rowOf = (index: CellIndex, size: number): number => Math.floor(index / size);
export const colOf = (index: CellIndex, size: number): number => index % size;
export const indexOf = (row: number, col: number, size: number): CellIndex => row * size + col;

/**
 * Map from cell index to the id of the cage containing it.
 * Length `size * size`. Every cell belongs to exactly one cage.
 */
export function cageIdByCell(puzzle: Puzzle): number[] {
  const map = new Array<number>(puzzle.size * puzzle.size).fill(-1);
  for (const cage of puzzle.cages) {
    for (const cell of cage.cells) map[cell] = cage.id;
  }
  return map;
}

/**
 * Operator glyphs as printed on a KenKen grid. The stored `Op` uses ASCII so
 * it stays easy to serialize, but puzzles are conventionally printed with the
 * real multiplication, division and minus signs.
 */
const OP_GLYPH: Record<Exclude<Op, '='>, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

/** Human-readable cage label, e.g. `"12+"`, `"3−"`, `"2÷"`, `"5"`. */
export function cageLabel(cage: Cage): string {
  return cage.op === '=' ? String(cage.target) : `${cage.target}${OP_GLYPH[cage.op]}`;
}

/**
 * One cage combination written out as arithmetic, e.g. `"1 + 2"`, `"8 ÷ 4"`, or
 * just `"3"` for a single-cell cage.
 *
 * `digits` is expected ascending; subtraction and division are printed
 * larger-operand-first so the expression evaluates to the cage's target, the way
 * a solver would read them off the grid (`4 − 1`, not `1 − 4`).
 */
export function combinationText(op: Op, digits: readonly number[]): string {
  if (op === '=') return String(digits[0]);
  const ordered = op === '-' || op === '/' ? [...digits].reverse() : digits;
  return ordered.join(` ${OP_GLYPH[op]} `);
}

/**
 * The cell a cage's label should be drawn in: its top-left-most cell.
 *
 * `Cage.cells` is documented as sorted ascending, so this is normally
 * `cells[0]`, but the minimum is taken explicitly so a mis-ordered cage
 * renders its label in the right place rather than somewhere arbitrary.
 */
export function cageAnchor(cage: Cage): CellIndex {
  let min = cage.cells[0];
  for (const cell of cage.cells) if (cell < min) min = cell;
  return min;
}
