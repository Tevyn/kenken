import { describe, expect, it } from 'vitest';
import {
  freebieBounds,
  paramsFor,
  scoreBand,
  scorePuzzle,
  solverEffort,
  tierFromScore,
} from './difficulty';
import { generateWithMetrics } from './generator';
import { solve } from './solver';
import { DIFFICULTIES, MAX_SIZE, MIN_SIZE } from './types';
import type { Cage, Difficulty, Puzzle } from './types';

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_unused, i) => MIN_SIZE + i);
const SEEDS = ['d0', 'd1', 'd2', 'd3'];

describe('paramsFor', () => {
  it('rejects an unknown difficulty', () => {
    expect(() => paramsFor(4, 'nope' as Difficulty)).toThrow(RangeError);
  });

  it.each(SIZES)('has a non-decreasing cage-size cap across tiers at size %i', (size) => {
    const caps = DIFFICULTIES.map((d) => paramsFor(size, d).maxCageSize);
    for (let i = 1; i < caps.length; i++) {
      expect(caps[i]).toBeGreaterThanOrEqual(caps[i - 1]);
    }
    // docs/KENKEN.md §3.3: never larger than 5 cells, even at 9x9.
    expect(Math.max(...caps)).toBeLessThanOrEqual(5);
    expect(Math.min(...caps)).toBeGreaterThanOrEqual(2);
  });

  it.each(SIZES)('skews the cage-size distribution larger for harder tiers at size %i', (size) => {
    const meanCageSize = (difficulty: Difficulty): number => {
      const { cageSizeWeights } = paramsFor(size, difficulty);
      let total = 0;
      let weighted = 0;
      cageSizeWeights.forEach((w, cageSize) => {
        total += w;
        weighted += w * cageSize;
      });
      return weighted / total;
    };
    expect(meanCageSize('expert')).toBeGreaterThan(meanCageSize('easy'));
    expect(meanCageSize('hard')).toBeGreaterThan(meanCageSize('medium'));
  });

  it('only ever offers the four real operators for generation', () => {
    for (const size of SIZES) {
      for (const difficulty of DIFFICULTIES) {
        for (const op of paramsFor(size, difficulty).allowedOps) {
          expect(['+', '-', '*', '/']).toContain(op);
        }
      }
    }
  });

  it('follows the reference table for the small easy grids', () => {
    // docs/KENKEN.md §4.2: 3x3 easy is +/x only; 4x4 and 5x5 easy add '-'.
    expect(paramsFor(3, 'easy').allowedOps.sort()).toEqual(['*', '+']);
    expect(paramsFor(4, 'easy').allowedOps.sort()).toEqual(['*', '+', '-']);
    expect(paramsFor(5, 'easy').allowedOps.sort()).toEqual(['*', '+', '-']);
    expect(paramsFor(6, 'easy').allowedOps.sort()).toEqual(['*', '+', '-', '/']);
    expect(paramsFor(4, 'easy').maxCageSize).toBe(2);
    expect(paramsFor(4, 'medium').maxCageSize).toBe(3);
    expect(paramsFor(9, 'expert').maxCageSize).toBe(5);
  });

  it('weights tight operators down as the tier rises', () => {
    // docs/KENKEN.md §4.1: '-' and '/' shrink a cage's candidate set, so more of
    // them makes a puzzle easier, not harder.
    const tight = (d: Difficulty) => paramsFor(6, d).opWeights['-'] + paramsFor(6, d).opWeights['/'];
    expect(tight('easy')).toBeGreaterThan(tight('medium'));
    expect(tight('medium')).toBeGreaterThan(tight('hard'));
    expect(tight('hard')).toBeGreaterThan(tight('expert'));
  });
});

describe('freebieBounds', () => {
  it.each(SIZES)('never overlaps between tiers at size %i', (size) => {
    const easy = freebieBounds(size, 'easy');
    const medium = freebieBounds(size, 'medium');
    const hard = freebieBounds(size, 'hard');
    const expert = freebieBounds(size, 'expert');

    expect(easy.min).toBeGreaterThan(medium.max);
    expect(medium.max).toBeGreaterThanOrEqual(hard.max);
    // docs/KENKEN.md §4.2: hard and expert get no freebies at all.
    expect(hard).toEqual({ min: 0, max: 0 });
    expect(expert).toEqual({ min: 0, max: 0 });

    for (const bounds of [easy, medium, hard, expert]) {
      expect(bounds.min).toBeLessThanOrEqual(bounds.max);
      expect(bounds.max).toBeLessThan(size * size);
    }
  });

  it('always guarantees an easy grid at least one freebie', () => {
    for (const size of SIZES) expect(freebieBounds(size, 'easy').min).toBeGreaterThanOrEqual(1);
  });
});

describe('scoreBand and tierFromScore', () => {
  it.each(SIZES)('covers the whole score range without gaps at size %i', (size) => {
    let previousMax = 0;
    for (const difficulty of DIFFICULTIES) {
      const [min, max] = scoreBand(size, difficulty);
      expect(min).toBe(previousMax);
      expect(max).toBeGreaterThan(min);
      previousMax = max;
    }
    expect(previousMax).toBeGreaterThan(100);
  });

  it.each(SIZES)('agrees with the bands at size %i', (size) => {
    for (const difficulty of DIFFICULTIES) {
      const [min, max] = scoreBand(size, difficulty);
      expect(tierFromScore(min, size)).toBe(difficulty);
      expect(tierFromScore(max - 1, size)).toBe(difficulty);
    }
  });

  it('rejects an unknown difficulty', () => {
    expect(() => scoreBand(4, 'nope' as Difficulty)).toThrow(RangeError);
  });
});

describe('solverEffort', () => {
  /** The exhaustively-verified 4x4 from `docs/KENKEN.md` §1.6. */
  const docPuzzle: Puzzle = {
    size: 4,
    difficulty: 'medium',
    seed: 'kenken-md-1.6',
    solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
    cages: [
      { id: 0, cells: [0, 4], op: '/', target: 3 },
      { id: 1, cells: [1, 5], op: '*', target: 8 },
      { id: 2, cells: [2, 3], op: '+', target: 7 },
      { id: 3, cells: [6, 10], op: '-', target: 3 },
      { id: 4, cells: [7, 11], op: '-', target: 1 },
      { id: 5, cells: [8, 12], op: '*', target: 8 },
      { id: 6, cells: [9, 13, 14], op: '*', target: 6 },
      { id: 7, cells: [15], op: '=', target: 1 },
    ],
  };

  it('is zero for a puzzle propagation solves on its own', () => {
    const stats = solve(docPuzzle, { limit: 1 }).stats;
    expect(stats.guesses).toBe(0);
    expect(solverEffort(stats)).toBe(0);
  });

  it('implements the reference formula B*3 + D*2', () => {
    const stats = solve(docPuzzle, { limit: 1 }).stats;
    expect(solverEffort(stats)).toBe(stats.guesses * 3 + stats.maxDepth * 2);
    expect(solverEffort({ ...stats, guesses: 7, maxDepth: 4 })).toBe(7 * 3 + 4 * 2);
  });
});

describe('scorePuzzle', () => {
  const base: Puzzle = {
    size: 4,
    difficulty: 'easy',
    seed: 'x',
    solution: [1, 2, 3, 4, 2, 1, 4, 3, 3, 4, 1, 2, 4, 3, 2, 1],
    cages: [
      { id: 0, cells: [0, 1, 5], op: '*', target: 2 },
      { id: 1, cells: [2, 3, 7], op: '*', target: 36 },
      { id: 2, cells: [4, 8], op: '-', target: 1 },
      { id: 3, cells: [6, 10], op: '+', target: 5 },
      { id: 4, cells: [9, 12, 13], op: '+', target: 11 },
      { id: 5, cells: [11, 15], op: '/', target: 2 },
      { id: 6, cells: [14], op: '=', target: 2 },
    ],
  };

  it('reports the structural features it is built on', () => {
    const metrics = scorePuzzle(base, solve(base, { limit: 1 }).stats);
    expect(metrics.freebies).toBe(1);
    expect(metrics.freebieRatio).toBeCloseTo(1 / 16);
    expect(metrics.avgCageSize).toBeCloseTo(16 / 7);
    expect(metrics.maxCageSize).toBe(3);
    expect(metrics.tightOpRatio).toBeCloseTo(2 / 6);
    expect(metrics.score).toBeGreaterThanOrEqual(0);
    expect(metrics.score).toBeLessThanOrEqual(100);
  });

  it('scores a puzzle lower when freebies are added', () => {
    const stats = solve(base, { limit: 1 }).stats;
    const split: Cage[] = base.cages[0].cells.map((cell, i) => ({
      id: i,
      cells: [cell],
      op: '=',
      target: base.solution[cell],
    }));
    const rest: Cage[] = base.cages.slice(1).map((c, i) => ({ ...c, id: i + split.length }));
    const withFreebies: Puzzle = { ...base, cages: [...split, ...rest] };
    expect(scorePuzzle(withFreebies, stats).score).toBeLessThan(scorePuzzle(base, stats).score);
  });

  it('scores a puzzle higher when the solver had to search', () => {
    const easyStats = solve(base, { limit: 1 }).stats;
    const hardStats = { ...easyStats, guesses: 40, maxDepth: 6 };
    expect(scorePuzzle(base, hardStats).score).toBeGreaterThan(scorePuzzle(base, easyStats).score);
  });
});

describe('difficulty is monotonic across generated puzzles', () => {
  const generated = new Map<string, ReturnType<typeof generateWithMetrics>>();
  const get = (size: number, difficulty: Difficulty, seed: string) => {
    const key = `${size}/${difficulty}/${seed}`;
    let value = generated.get(key);
    if (!value) {
      value = generateWithMetrics({ size, difficulty, seed });
      generated.set(key, value);
    }
    return value;
  };

  it.each(SIZES)('freebies strictly decrease from easy to expert at size %i', (size) => {
    for (const seed of SEEDS) {
      const counts = DIFFICULTIES.map((d) => get(size, d, seed).metrics.freebies);
      const [easy, medium, hard, expert] = counts;
      expect(easy).toBeGreaterThan(medium);
      expect(medium).toBeGreaterThanOrEqual(hard);
      expect(hard).toBe(0);
      expect(expert).toBe(0);
    }
  }, 180_000);

  it.each(SIZES)('every generated puzzle lands in its own tier band at size %i', (size) => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const { metrics, inBand } = get(size, difficulty, seed);
        expect(inBand).toBe(true);
        expect(tierFromScore(metrics.score, size)).toBe(difficulty);
      }
    }
  }, 180_000);

  it.each(SIZES)('median score rises with each tier at size %i', (size) => {
    const median = (difficulty: Difficulty): number => {
      const scores = SEEDS.map((seed) => get(size, difficulty, seed).metrics.score).sort(
        (a, b) => a - b,
      );
      return scores[Math.floor(scores.length / 2)];
    };
    expect(median('easy')).toBeLessThan(median('medium'));
    expect(median('medium')).toBeLessThan(median('hard'));
    expect(median('hard')).toBeLessThan(median('expert'));
  }, 180_000);

  it.each(SIZES)('average cage size never falls as the tier rises at size %i', (size) => {
    const meanCage = (difficulty: Difficulty): number => {
      const values = SEEDS.map((seed) => get(size, difficulty, seed).metrics.avgCageSize);
      return values.reduce((a, b) => a + b, 0) / values.length;
    };
    // Only non-decreasing in general: at 3x3, medium/hard/expert share the same
    // 3-cell cap, so their realised averages can tie.
    expect(meanCage('easy')).toBeLessThanOrEqual(meanCage('medium'));
    expect(meanCage('medium')).toBeLessThanOrEqual(meanCage('hard'));
    expect(meanCage('hard')).toBeLessThanOrEqual(meanCage('expert'));
    expect(meanCage('easy')).toBeLessThan(meanCage('expert'));
  }, 180_000);
});
