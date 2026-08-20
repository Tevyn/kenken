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
 */

import type { CellIndex, Grid, Puzzle } from './types';
import { cageSatisfied } from './cages';
import { solve } from './solver';

export { generatePuzzle } from './generator';
export { encodePuzzle, decodePuzzle } from './codec';

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
 */
export function findConflicts(puzzle: Puzzle, grid: Grid): Set<CellIndex> {
  const size = puzzle.size;
  const conflicts = new Set<CellIndex>();
  if (grid.length !== size * size) return conflicts;

  // Duplicate digits within a row or a column.
  for (let line = 0; line < size; line++) {
    const rowCells: number[] = [];
    const colCells: number[] = [];
    for (let k = 0; k < size; k++) {
      rowCells.push(line * size + k);
      colCells.push(k * size + line);
    }
    markDuplicates(rowCells, grid, conflicts);
    markDuplicates(colCells, grid, conflicts);
  }

  // Fully-filled cages whose arithmetic does not work out.
  for (const cage of puzzle.cages) {
    const values: number[] = [];
    let complete = true;
    for (const cell of cage.cells) {
      const v = grid[cell];
      if (v === null || v === undefined) {
        complete = false;
        break;
      }
      values.push(v);
    }
    if (!complete) continue;
    if (!cageSatisfied(cage, values)) {
      for (const cell of cage.cells) conflicts.add(cell);
    }
  }

  return conflicts;
}

function markDuplicates(cells: readonly number[], grid: Grid, out: Set<CellIndex>): void {
  const byValue = new Map<number, number[]>();
  for (const cell of cells) {
    const value = grid[cell];
    if (value === null || value === undefined) continue;
    const list = byValue.get(value);
    if (list) list.push(cell);
    else byValue.set(value, [cell]);
  }
  for (const list of byValue.values()) {
    if (list.length > 1) for (const cell of list) out.add(cell);
  }
}

export * from './types';
