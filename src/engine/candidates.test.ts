import { describe, expect, it } from 'vitest';
import {
  bit,
  buildCandidateState,
  buildUnits,
  cageSumSet,
  candidateSets,
  digitsToMask,
  maskToDigits,
  peersOf,
  popcount,
  singletonCageSum,
  soleDigit,
  unitLine,
  visibleSets,
} from './candidates';
import { DOC_PUZZLE } from '../fixtures/docPuzzle';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import type { Grid, Op, Puzzle } from './types';

const empty = (size: number): Grid => new Array<number | null>(size * size).fill(null);
const noMarks = (size: number): number[][] =>
  Array.from({ length: size * size }, () => [] as number[]);

/**
 * A puzzle carrying nothing but the cages under test. `solution` is left empty
 * on purpose: the candidate machinery must never consult it, so any code that
 * started to would fail loudly here.
 */
function bareCages(size: number, cages: Array<[number[], Op, number]>): Puzzle {
  return {
    size,
    difficulty: 'easy',
    seed: 'candidates-test',
    solution: [],
    cages: cages.map(([cells, op, target], id) => ({ id, cells, op, target })),
  };
}

describe('bitmask helpers', () => {
  it('maps digits to single bits', () => {
    expect(bit(1)).toBe(1);
    expect(bit(4)).toBe(8);
  });

  it('counts and lists set bits', () => {
    const mask = digitsToMask([1, 3, 4]);
    expect(popcount(mask)).toBe(3);
    expect(maskToDigits(mask, 4)).toEqual([1, 3, 4]);
  });

  it('ignores digits above the grid size when listing', () => {
    expect(maskToDigits(digitsToMask([1, 5]), 4)).toEqual([1]);
  });

  it('reads a singleton mask and refuses anything else', () => {
    expect(soleDigit(bit(3))).toBe(3);
    expect(soleDigit(digitsToMask([2, 3]))).toBe(0);
    expect(soleDigit(0)).toBe(0);
  });
});

describe('units and peers', () => {
  it('lists every row then every column', () => {
    const units = buildUnits(3);
    expect(units).toHaveLength(6);
    expect(units[0]).toEqual([0, 1, 2]);
    expect(units[2]).toEqual([6, 7, 8]);
    expect(units[3]).toEqual([0, 3, 6]);
    expect(units[5]).toEqual([2, 5, 8]);
  });

  it('numbers rows then columns from the same key space', () => {
    expect(unitLine(0, 4)).toBe(0);
    expect(unitLine(3, 4)).toBe(3);
    expect(unitLine(4, 4)).toBe(0);
    expect(unitLine(7, 4)).toBe(3);
  });

  it('lists row and column peers once each, ascending', () => {
    expect(peersOf(5, 4)).toEqual([1, 4, 6, 7, 9, 13]);
  });
});

describe('buildCandidateState: seeding', () => {
  it('starts an empty cell with every digit and a filled cell with its own', () => {
    const puzzle = bareCages(4, [[[0, 1], '-', 1]]);
    const values = empty(4);
    values[8] = 3;
    const state = buildCandidateState(puzzle, values);
    // Cell 12 shares a column with the filled 3 and belongs to no cage.
    expect(maskToDigits(state.cands[12], 4)).toEqual([1, 2, 4]);
    expect(maskToDigits(state.cands[8], 4)).toEqual([3]);
  });

  it('treats an out-of-range entry as empty rather than crashing', () => {
    const puzzle = bareCages(4, [[[0, 1], '-', 1]]);
    const values = empty(4);
    values[5] = 9;
    const state = buildCandidateState(puzzle, values);
    expect(state.contradiction).toBe(false);
    expect(maskToDigits(state.cands[5], 4)).toEqual([1, 2, 3, 4]);
  });
});

describe('buildCandidateState: rule (A), cage combinations', () => {
  it('narrows a cell to what its cage can offer it', () => {
    // 7+ over two cells of one row admits only {3,4}.
    const state = buildCandidateState(bareCages(4, [[[2, 3], '+', 7]]), empty(4));
    expect(maskToDigits(state.cands[2], 4)).toEqual([3, 4]);
    expect(maskToDigits(state.cands[3], 4)).toEqual([3, 4]);
  });

  it('pins a bent cage that has only one arrangement', () => {
    // 2x over cells 0,1,5: the only legal assignment is 1,2,1.
    const state = buildCandidateState(bareCages(4, [[[0, 1, 5], '*', 2]]), empty(4));
    expect(state.combos[0]).toEqual([[1, 2, 1]]);
    expect(maskToDigits(state.cands[0], 4)).toEqual([1]);
    expect(maskToDigits(state.cands[1], 4)).toEqual([2]);
    expect(maskToDigits(state.cands[5], 4)).toEqual([1]);
  });

  it('drops combinations that disagree with what the player has written', () => {
    const puzzle = bareCages(4, [[[0, 4], '/', 3]]);
    const values = empty(4);
    values[4] = 3;
    const state = buildCandidateState(puzzle, values);
    expect(state.combos[0]).toEqual([[1, 3]]);
    expect(maskToDigits(state.cands[0], 4)).toEqual([1]);
  });
});

describe('buildCandidateState: rule (B), peer elimination', () => {
  it('clears a solved digit from its row and column', () => {
    const puzzle = bareCages(4, [[[14], '=', 2]]);
    const state = buildCandidateState(puzzle, empty(4));
    expect(maskToDigits(state.cands[14], 4)).toEqual([2]);
    expect(maskToDigits(state.cands[12], 4)).toEqual([1, 3, 4]); // row peer
    expect(maskToDigits(state.cands[2], 4)).toEqual([1, 3, 4]); // column peer
    expect(maskToDigits(state.cands[0], 4)).toEqual([1, 2, 3, 4]); // neither
  });

  it('runs (A) and (B) alternately to a fixpoint', () => {
    // The 3/ cage alone gives {1,3} to both its cells; the freebie 3 in cell 4's
    // row then kills the 3 there, which forces cell 4 = 1 and cell 0 = 3.
    const puzzle = bareCages(4, [
      [[0, 4], '/', 3],
      [[6], '=', 3],
    ]);
    const state = buildCandidateState(puzzle, empty(4));
    expect(maskToDigits(state.cands[4], 4)).toEqual([1]);
    expect(maskToDigits(state.cands[0], 4)).toEqual([3]);
  });

  it('reports a contradiction rather than throwing', () => {
    const puzzle = bareCages(4, [
      [[0], '=', 2],
      [[1], '=', 2],
    ]);
    expect(buildCandidateState(puzzle, empty(4)).contradiction).toBe(true);
  });

  it('reports a contradiction for an impossible cage', () => {
    // No two distinct digits in 1..4 have a difference of 9.
    expect(buildCandidateState(bareCages(4, [[[0, 1], '-', 9]]), empty(4)).contradiction).toBe(
      true,
    );
  });
});

describe('candidateSets', () => {
  it('solves the docs/KENKEN.md fixture from rules (A)+(B) alone', () => {
    // Worth pinning down: the fixture is tight enough that bookkeeping finishes
    // it without a single named technique. docs/HINTS.md §4 describes some of
    // its examples against a weaker, single-pass state; the fixpoint the spec
    // actually calls for in §2 is this one.
    const book = candidateSets(DOC_PUZZLE, empty(4));
    expect(book.map((c) => (c.length === 1 ? c[0] : 0))).toEqual(DOC_PUZZLE.solution);
  });

  it('never proposes a digit that contradicts the true solution', () => {
    const book = candidateSets(SAMPLE_PUZZLE, empty(4));
    book.forEach((digits, cell) => {
      expect(digits).toContain(SAMPLE_PUZZLE.solution[cell]);
    });
  });
});

describe('visibleSets', () => {
  it('uses the player pencil marks when they wrote any', () => {
    const marks = noMarks(4);
    marks[5] = [2, 4];
    expect(visibleSets(SAMPLE_PUZZLE, empty(4), marks)[5]).toEqual([2, 4]);
  });

  it('falls back to "not yet used in this row or column" when they did not', () => {
    const values = empty(4);
    values[4] = 1;
    values[1] = 2;
    expect(visibleSets(SAMPLE_PUZZLE, values, noMarks(4))[5]).toEqual([3, 4]);
  });

  it('shows a filled cell as its own digit', () => {
    const values = empty(4);
    values[7] = 3;
    expect(visibleSets(SAMPLE_PUZZLE, values, noMarks(4))[7]).toEqual([3]);
  });

  it('is wider than the book whenever the player has not done the pencil work', () => {
    // The whole point of the split: `visible` is generous, `book` is the truth.
    const visible = visibleSets(DOC_PUZZLE, empty(4), noMarks(4));
    const book = candidateSets(DOC_PUZZLE, empty(4));
    expect(visible[0]).toEqual([1, 2, 3, 4]);
    expect(book[0]).toEqual([1]);
  });
});

describe('cageSumSet', () => {
  it('is the target for a + cage over all its cells', () => {
    const state = buildCandidateState(bareCages(4, [[[2, 3], '+', 7]]), empty(4));
    expect([...cageSumSet(state, 0)]).toEqual([7]);
    expect(singletonCageSum(state, 0)).toBe(7);
  });

  it('is the target for a freebie cage', () => {
    const state = buildCandidateState(bareCages(4, [[[15], '=', 1]]), empty(4));
    expect(singletonCageSum(state, 0)).toBe(1);
  });

  it('is NOT the target for a - cage: a 1- pair in a 4x4 sums to 3, 5 or 7', () => {
    // This is the KenKen-specific correction that innies and outies turn on.
    const state = buildCandidateState(bareCages(4, [[[7, 11], '-', 1]]), empty(4));
    expect([...cageSumSet(state, 0)].sort((a, b) => a - b)).toEqual([3, 5, 7]);
    expect(singletonCageSum(state, 0)).toBeNull();
  });

  it('is a singleton for a x cage whose factorisation is forced', () => {
    // 8x over two cells of 1..4 can only be {2,4}, so it sums to 6.
    const state = buildCandidateState(bareCages(4, [[[1, 5], '*', 8]]), empty(4));
    expect(singletonCageSum(state, 0)).toBe(6);
  });

  it('sums a chosen subset of the cage positions', () => {
    // 6x over cells 9, 13 and 14 can only be a permutation of {1,2,3}; its two
    // column-1 cells therefore sum to anything but the third digit.
    const state = buildCandidateState(bareCages(4, [[[9, 13, 14], '*', 6]]), empty(4));
    expect(singletonCageSum(state, 0)).toBe(6);
    expect([...cageSumSet(state, 0, [0, 1])].sort((a, b) => a - b)).toEqual([3, 4, 5]);
  });

  it('tightens as the player fills cells in', () => {
    const puzzle = bareCages(4, [[[7, 11], '-', 1]]);
    const values = empty(4);
    values[7] = 2;
    const state = buildCandidateState(puzzle, values);
    expect([...cageSumSet(state, 0)].sort((a, b) => a - b)).toEqual([3, 5]);
  });
});
