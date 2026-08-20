import { describe, expect, it } from 'vitest';
import { cyclicLatinSquare, generateLatinSquare, isLatinSquare } from './latin';
import { makeRng } from './rng';
import { MAX_SIZE, MIN_SIZE } from './types';

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_unused, i) => MIN_SIZE + i);

describe('generateLatinSquare', () => {
  it.each(SIZES)('produces a valid Latin square of order %i over many seeds', (size) => {
    for (let s = 0; s < 40; s++) {
      const grid = generateLatinSquare(size, makeRng(`latin-${size}-${s}`));
      expect(grid).toHaveLength(size * size);
      expect(isLatinSquare(grid, size)).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    for (const size of SIZES) {
      const a = generateLatinSquare(size, makeRng(`det-${size}`));
      const b = generateLatinSquare(size, makeRng(`det-${size}`));
      expect(a).toEqual(b);
    }
  });

  it('produces varied squares across seeds', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 30; s++) {
      seen.add(generateLatinSquare(6, makeRng(`varied-${s}`)).join(','));
    }
    expect(seen.size).toBe(30);
  });

  it('reaches squares that a permuted cyclic square could never produce', () => {
    // In any row/column/symbol permutation of a cyclic square, every row is a
    // rotation of every other row. Backtracking must reach squares where that
    // is false, otherwise it samples no better than the cheap construction.
    const size = 5;
    let nonCyclic = 0;
    for (let s = 0; s < 30; s++) {
      const grid = generateLatinSquare(size, makeRng(`iso-${s}`));
      const rowOf = (r: number) => grid.slice(r * size, r * size + size);
      const first = rowOf(0);
      const rotations = new Set<string>();
      for (let k = 0; k < size; k++) {
        rotations.add(first.map((_unused, c) => first[(c + k) % size]).join(','));
      }
      for (let r = 1; r < size; r++) {
        if (!rotations.has(rowOf(r).join(','))) {
          nonCyclic++;
          break;
        }
      }
    }
    expect(nonCyclic).toBeGreaterThan(0);
  });

  it('uses every digit exactly once per row and column', () => {
    const size = 7;
    const grid = generateLatinSquare(size, makeRng('counts'));
    for (let line = 0; line < size; line++) {
      const row = new Set<number>();
      const col = new Set<number>();
      for (let k = 0; k < size; k++) {
        row.add(grid[line * size + k]);
        col.add(grid[k * size + line]);
      }
      expect(row.size).toBe(size);
      expect(col.size).toBe(size);
    }
  });

  it('rejects a non-positive order', () => {
    expect(() => generateLatinSquare(0, makeRng('x'))).toThrow(RangeError);
    expect(() => generateLatinSquare(2.5, makeRng('x'))).toThrow(RangeError);
  });
});

describe('cyclicLatinSquare (fallback)', () => {
  it.each(SIZES)('is always valid at order %i', (size) => {
    for (let s = 0; s < 10; s++) {
      expect(isLatinSquare(cyclicLatinSquare(size, makeRng(`cyc-${size}-${s}`)), size)).toBe(true);
    }
  });
});

describe('isLatinSquare', () => {
  it('rejects the wrong length', () => {
    expect(isLatinSquare([1, 2, 3], 3)).toBe(false);
  });

  it('rejects out-of-range values', () => {
    expect(isLatinSquare([1, 2, 2, 9], 2)).toBe(false);
    expect(isLatinSquare([0, 1, 1, 0], 2)).toBe(false);
  });

  it('rejects a duplicate in a row or column', () => {
    expect(isLatinSquare([1, 1, 2, 2], 2)).toBe(false);
    expect(isLatinSquare([1, 2, 1, 2], 2)).toBe(false);
  });

  it('accepts a genuine square', () => {
    expect(isLatinSquare([1, 2, 2, 1], 2)).toBe(true);
  });
});
