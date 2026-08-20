import { describe, expect, it } from 'vitest';
import {
  assignCageOps,
  cageSatisfied,
  isConnected,
  legalOps,
  neighborsOf,
  partitionCages,
} from './cages';
import { paramsFor } from './difficulty';
import { generateLatinSquare } from './latin';
import { makeRng } from './rng';
import { DIFFICULTIES, MAX_SIZE, MIN_SIZE } from './types';
import type { Cage, CellIndex } from './types';

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_unused, i) => MIN_SIZE + i);

describe('neighborsOf', () => {
  it('gives orthogonal neighbours only, clipped at the border', () => {
    expect(neighborsOf(0, 3).sort((a, b) => a - b)).toEqual([1, 3]);
    expect(neighborsOf(4, 3).sort((a, b) => a - b)).toEqual([1, 3, 5, 7]);
    expect(neighborsOf(8, 3).sort((a, b) => a - b)).toEqual([5, 7]);
  });

  it('does not wrap around a row edge', () => {
    // Cell 2 is the right edge of row 0 on a 3x3; cell 3 starts row 1.
    expect(neighborsOf(2, 3)).not.toContain(3);
  });
});

describe('isConnected', () => {
  it('accepts single cells and straight or bent dominoes', () => {
    expect(isConnected([5], 4)).toBe(true);
    expect(isConnected([0, 1], 4)).toBe(true);
    expect(isConnected([0, 4], 4)).toBe(true);
    expect(isConnected([0, 1, 5], 4)).toBe(true);
  });

  it('rejects a diagonal pair and a split group', () => {
    expect(isConnected([0, 5], 4)).toBe(false);
    expect(isConnected([0, 1, 10, 11], 4)).toBe(false);
  });
});

describe('partitionCages', () => {
  for (const size of SIZES) {
    for (const difficulty of DIFFICULTIES) {
      it(`covers a ${size}x${size} ${difficulty} grid exactly once with connected cages`, () => {
        const params = paramsFor(size, difficulty);
        for (let s = 0; s < 12; s++) {
          const rng = makeRng(`part-${size}-${difficulty}-${s}`);
          const partition = partitionCages(size, rng, params);

          const seen = new Set<CellIndex>();
          for (const cage of partition) {
            expect(cage.length).toBeGreaterThan(0);
            expect(cage.length).toBeLessThanOrEqual(params.maxCageSize);
            expect(isConnected(cage, size)).toBe(true);
            // Sorted ascending, so cells[0] is the top-left label anchor.
            expect(cage.slice().sort((a, b) => a - b)).toEqual(cage);
            for (const cell of cage) {
              expect(seen.has(cell)).toBe(false);
              seen.add(cell);
            }
          }
          expect(seen.size).toBe(size * size);

          const freebies = partition.filter((c) => c.length === 1).length;
          expect(freebies).toBeGreaterThanOrEqual(params.minFreebies);
          expect(freebies).toBeLessThanOrEqual(params.maxFreebies);
        }
      });
    }
  }

  it('is deterministic for a given seed', () => {
    const params = paramsFor(6, 'hard');
    const a = partitionCages(6, makeRng('same'), params);
    const b = partitionCages(6, makeRng('same'), params);
    expect(a).toEqual(b);
  });

  it('produces different layouts for different seeds', () => {
    const params = paramsFor(6, 'medium');
    const seen = new Set<string>();
    for (let s = 0; s < 20; s++) {
      seen.add(JSON.stringify(partitionCages(6, makeRng(`layout-${s}`), params)));
    }
    expect(seen.size).toBeGreaterThan(15);
  });
});

describe('legalOps', () => {
  it('returns the freebie operator for a single cell', () => {
    expect(legalOps([4], ['+', '-', '*', '/'])).toEqual([{ op: '=', target: 4 }]);
  });

  it('offers division only for exact integer quotients', () => {
    expect(legalOps([2, 6], ['/'])).toEqual([{ op: '/', target: 3 }]);
    expect(legalOps([4, 6], ['/'])).toEqual([]);
  });

  it('never offers a quotient of 1', () => {
    expect(legalOps([3, 3], ['/'])).toEqual([]);
  });

  it('never offers a difference of 0', () => {
    expect(legalOps([3, 3], ['-'])).toEqual([]);
  });

  it('offers only + and * for 3 or more cells', () => {
    const ops = legalOps([1, 2, 3], ['+', '-', '*', '/']).map((c) => c.op);
    expect(ops.sort()).toEqual(['*', '+']);
  });

  it('honours the allowed-operator list', () => {
    expect(legalOps([2, 4], ['+']).map((c) => c.op)).toEqual(['+']);
  });
});

describe('assignCageOps', () => {
  for (const size of SIZES) {
    for (const difficulty of DIFFICULTIES) {
      it(`gives every ${size}x${size} ${difficulty} cage a target its values satisfy`, () => {
        const params = paramsFor(size, difficulty);
        for (let s = 0; s < 8; s++) {
          const rng = makeRng(`ops-${size}-${difficulty}-${s}`);
          const solution = generateLatinSquare(size, rng);
          const partition = partitionCages(size, rng, params);
          const cages = assignCageOps(partition, solution, rng, params);

          expect(cages.map((c) => c.id)).toEqual(cages.map((_unused, i) => i));

          for (const cage of cages) {
            const values = cage.cells.map((c) => solution[c]);
            expect(cageSatisfied(cage, values)).toBe(true);
            expect(Number.isInteger(cage.target)).toBe(true);
            expect(cage.target).toBeGreaterThan(0);

            if (cage.op === '-' || cage.op === '/') {
              expect(cage.cells).toHaveLength(2);
            }
            if (cage.op === '=') {
              expect(cage.cells).toHaveLength(1);
              expect(cage.target).toBe(values[0]);
            }
            if (cage.op === '/') {
              const hi = Math.max(...values);
              const lo = Math.min(...values);
              expect(hi % lo).toBe(0);
              expect(cage.target).toBe(hi / lo);
            }
            if (cage.cells.length > 2) {
              expect(['+', '*']).toContain(cage.op);
            }
            expect(params.allowedOps.concat('=')).toContain(cage.op);
          }
        }
      });
    }
  }
});

describe('cageSatisfied', () => {
  const cage = (op: Cage['op'], target: number, cells: number[]): Cage => ({
    id: 0,
    cells,
    op,
    target,
  });

  it('checks sums and products over any cage size', () => {
    expect(cageSatisfied(cage('+', 9, [0, 1, 2]), [2, 3, 4])).toBe(true);
    expect(cageSatisfied(cage('+', 8, [0, 1, 2]), [2, 3, 4])).toBe(false);
    expect(cageSatisfied(cage('*', 24, [0, 1, 2]), [2, 3, 4])).toBe(true);
    expect(cageSatisfied(cage('*', 25, [0, 1, 2]), [2, 3, 4])).toBe(false);
  });

  it('treats subtraction as an absolute difference', () => {
    expect(cageSatisfied(cage('-', 2, [0, 1]), [5, 3])).toBe(true);
    expect(cageSatisfied(cage('-', 2, [0, 1]), [3, 5])).toBe(true);
    expect(cageSatisfied(cage('-', 3, [0, 1]), [3, 5])).toBe(false);
  });

  it('requires an exact quotient for division', () => {
    expect(cageSatisfied(cage('/', 3, [0, 1]), [6, 2])).toBe(true);
    expect(cageSatisfied(cage('/', 3, [0, 1]), [2, 6])).toBe(true);
    expect(cageSatisfied(cage('/', 2, [0, 1]), [5, 2])).toBe(false);
  });

  it('rejects the wrong number of values', () => {
    expect(cageSatisfied(cage('-', 1, [0, 1]), [3])).toBe(false);
    expect(cageSatisfied(cage('=', 3, [0]), [3, 3])).toBe(false);
  });
});
