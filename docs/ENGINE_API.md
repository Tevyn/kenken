# Engine public API contract

Both the engine implementation and the UI are written against this file.
Types live in `src/engine/types.ts` (already written — treat it as fixed).
The engine's public surface is `src/engine/index.ts`.

```ts
import type {
  Puzzle, GenerateOptions, Grid, CellIndex, Difficulty, Op, Cage,
} from './types'

/**
 * Generate a puzzle with exactly one solution.
 * Deterministic: same `seed` + `size` + `difficulty` => identical puzzle.
 * Must return within ~1s for size 9 / expert on a normal laptop.
 * Throws RangeError for size outside 3..9.
 */
export function generatePuzzle(options: GenerateOptions): Puzzle

/**
 * Find solutions to a puzzle's cage constraints (ignores `puzzle.solution`).
 * Stops once `limit` solutions are found. Each solution is a `number[]` of
 * length size*size.
 */
export function solvePuzzle(puzzle: Puzzle, limit?: number): number[][]

/** Number of solutions, capped at `cap` (default 2). Used for uniqueness checks. */
export function countSolutions(puzzle: Puzzle, cap?: number): number

/** True when `grid` is completely filled and satisfies every constraint. */
export function isSolved(puzzle: Puzzle, grid: Grid): boolean

/**
 * Cells that currently violate a constraint: a duplicate digit in its row or
 * column, or membership in a fully-filled cage whose arithmetic is wrong.
 * Empty cells are never reported.
 */
export function findConflicts(puzzle: Puzzle, grid: Grid): Set<CellIndex>

/** Serialize/parse a puzzle to a compact string (round-trips exactly). */
export function encodePuzzle(puzzle: Puzzle): string
export function decodePuzzle(text: string): Puzzle

// Re-export everything from ./types as well.
export * from './types'
```

## Semantics of cage arithmetic

- `'='` — single cell, value equals `target`.
- `'+'` — sum of all cells equals `target`.
- `'*'` — product of all cells equals `target`.
- `'-'` — exactly 2 cells; `|a - b| === target`.
- `'/'` — exactly 2 cells; `max/min === target` and `max % min === 0`.

Digits **may** repeat inside a cage as long as row/column uniqueness holds.

## Notes

- No `Math.random()` anywhere in the engine: use a seeded PRNG so puzzles are
  reproducible from `Puzzle.seed`.
- The engine must be dependency-free and run in a browser and in Node.
