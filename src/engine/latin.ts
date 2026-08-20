/**
 * Random Latin square generation.
 *
 * A KenKen solution grid is exactly a Latin square of order N: every digit
 * 1..N appears once per row and once per column.
 *
 * Strategy: randomized cell-by-cell backtracking with a step budget and
 * restarts. That samples the space of Latin squares far more evenly than the
 * common shortcut of shuffling the rows/columns/symbols of a cyclic square
 * (which only ever reaches the isotopy class of the cyclic group). The cyclic
 * construction is kept only as a never-fails fallback.
 */

import type { Rng } from './rng';

/** Thrown internally when a randomized attempt blows its step budget. */
class RestartSignal extends Error {}

/**
 * Build a Latin square of order `size` as a flat array (index = row*size+col)
 * of values 1..size.
 */
export function generateLatinSquare(size: number, rng: Rng): number[] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`Latin square order must be a positive integer, got ${size}`);
  }

  const cells = size * size;
  const full = (1 << size) - 1;
  const budget = 400 * cells + 2000;
  const restarts = 24;

  for (let attempt = 0; attempt < restarts; attempt++) {
    const grid = new Array<number>(cells).fill(0);
    const rowUsed = new Array<number>(size).fill(0);
    const colUsed = new Array<number>(size).fill(0);
    let steps = 0;

    const dfs = (pos: number): boolean => {
      if (pos === cells) return true;
      if (++steps > budget) throw new RestartSignal();

      const row = (pos / size) | 0;
      const col = pos % size;
      let free = full & ~(rowUsed[row] | colUsed[col]);
      if (free === 0) return false;

      // Collect the free digits, then try them in random order.
      const options: number[] = [];
      while (free !== 0) {
        const bit = free & -free;
        free ^= bit;
        options.push(31 - Math.clz32(bit) + 1);
      }
      rng.shuffle(options);

      for (const value of options) {
        const bit = 1 << (value - 1);
        grid[pos] = value;
        rowUsed[row] |= bit;
        colUsed[col] |= bit;
        if (dfs(pos + 1)) return true;
        rowUsed[row] &= ~bit;
        colUsed[col] &= ~bit;
        grid[pos] = 0;
      }
      return false;
    };

    try {
      if (dfs(0)) return grid;
    } catch (err) {
      if (!(err instanceof RestartSignal)) throw err;
      // else: fall through to the next attempt
    }
  }

  return cyclicLatinSquare(size, rng);
}

/**
 * Fallback: a shuffled cyclic square. Always a valid Latin square, but only
 * ever a relabelled/permuted cyclic group table, so it is a poor sampler.
 */
export function cyclicLatinSquare(size: number, rng: Rng): number[] {
  const rowOrder = rng.shuffle(range(size));
  const colOrder = rng.shuffle(range(size));
  const symbols = rng.shuffle(range(size).map((v) => v + 1));

  const grid = new Array<number>(size * size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      grid[r * size + c] = symbols[(rowOrder[r] + colOrder[c]) % size];
    }
  }
  return grid;
}

/** True when `grid` is a valid Latin square of the given order. */
export function isLatinSquare(grid: readonly number[], size: number): boolean {
  if (grid.length !== size * size) return false;
  const full = (1 << size) - 1;
  const rowSeen = new Array<number>(size).fill(0);
  const colSeen = new Array<number>(size).fill(0);

  for (let i = 0; i < grid.length; i++) {
    const value = grid[i];
    if (!Number.isInteger(value) || value < 1 || value > size) return false;
    const bit = 1 << (value - 1);
    const row = (i / size) | 0;
    const col = i % size;
    if ((rowSeen[row] & bit) !== 0) return false;
    if ((colSeen[col] & bit) !== 0) return false;
    rowSeen[row] |= bit;
    colSeen[col] |= bit;
  }

  for (let i = 0; i < size; i++) {
    if (rowSeen[i] !== full || colSeen[i] !== full) return false;
  }
  return true;
}

function range(n: number): number[] {
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = i;
  return out;
}
