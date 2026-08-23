/**
 * Public surface of the KenKen engine — see `docs/ENGINE_API.md`.
 *
 * Module map:
 *   rng.ts         seeded PRNG (the only Math.random in the engine lives there)
 *   latin.ts       random Latin square (the solution grid)
 *   cages.ts       grid partitioning plus operator/target assignment
 *   solver.ts      cage-combination CSP + propagation + MRV search
 *   difficulty.ts  per-tier generation parameters and puzzle scoring
 *   generator.ts   the generate -> verify -> repair pipeline
 *   codec.ts       compact serialization
 *   errors.ts      live, solution-free error detection for a player's grid
 *   candidates.ts  reporting-oriented candidate bookkeeping for the hint engine
 *   unitSums.ts    the N(N+1)/2 innie/outie deductions
 *   hints.ts       the hint ladder: find, explain, highlight, apply
 */

import type { CellIndex, Grid, Puzzle } from './types';
import { cageSatisfied } from './cages';
import { solve } from './solver';
import { findGridErrors } from './errors';

export { generatePuzzle } from './generator';
export { encodePuzzle, decodePuzzle } from './codec';
export { createErrorChecker, findGridErrors, DEFAULT_ERROR_COMBO_CAP } from './errors';
export type { ErrorChecker, ErrorCheckOptions, GridErrors } from './errors';
export {
  ENABLED_TECHNIQUES,
  TECHNIQUE_RANK,
  candidateSets,
  checkCorrectness,
  detectContext,
  detectorFor,
  findHint,
  findNextNumber,
  hintSignature,
  pickHint,
  revealHint,
  visibleSets,
} from './hints';
export type {
  CorrectnessReport,
  DetectContext,
  Detector,
  Hint,
  HintApply,
  HintHighlight,
  HintOptions,
  HintResult,
  MarkSets,
  NextNumber,
  TechniqueId,
} from './hints';
export { unitTotal } from './unitSums';
export type { UnitSumInnie, UnitSumOutie } from './unitSums';

/**
 * Find solutions to a puzzle's cage constraints (ignores `puzzle.solution`).
 * Stops once `limit` solutions have been found.
 */
export function solvePuzzle(puzzle: Puzzle, limit = 1): number[][] {
  return solve(puzzle, { limit }).solutions;
}

/** Number of solutions, capped at `cap`. Used for uniqueness checks. */
export function countSolutions(puzzle: Puzzle, cap = 2): number {
  return solve(puzzle, { limit: cap }).solutions.length;
}

/** True when `grid` is completely filled and satisfies every constraint. */
export function isSolved(puzzle: Puzzle, grid: Grid): boolean {
  const size = puzzle.size;
  if (grid.length !== size * size) return false;

  const rowSeen = new Array<number>(size).fill(0);
  const colSeen = new Array<number>(size).fill(0);
  for (let i = 0; i < grid.length; i++) {
    const value = grid[i];
    if (value === null || !Number.isInteger(value) || value < 1 || value > size) return false;
    const bit = 1 << (value - 1);
    const row = (i / size) | 0;
    const col = i % size;
    if ((rowSeen[row] & bit) !== 0 || (colSeen[col] & bit) !== 0) return false;
    rowSeen[row] |= bit;
    colSeen[col] |= bit;
  }

  for (const cage of puzzle.cages) {
    const values = cage.cells.map((c) => grid[c] as number);
    if (!cageSatisfied(cage, values)) return false;
  }

  // Every cell must actually belong to a cage, or "solved" would be meaningless.
  const covered = new Set<number>();
  for (const cage of puzzle.cages) for (const cell of cage.cells) covered.add(cell);
  return covered.size === size * size;
}

/**
 * Cells that currently violate a constraint: a duplicate digit in their row or
 * column, or membership in a fully-filled cage whose arithmetic is wrong.
 * Empty cells are never reported.
 *
 * This is the "immediately obvious" subset of `findGridErrors` — it deliberately
 * says nothing about partially-filled cages, however doomed they may be. Use
 * `createErrorChecker` for the full live check.
 */
export function findConflicts(puzzle: Puzzle, grid: Grid): Set<CellIndex> {
  return findGridErrors(puzzle, grid, { partialCages: false }).cells;
}

export * from './types';
