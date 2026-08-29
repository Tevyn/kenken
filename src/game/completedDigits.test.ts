import { describe, expect, it } from 'vitest';
import type { GridErrors } from '../engine/errors';
import type { Grid } from '../engine/types';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import { completedDigits } from './completedDigits';

/*
 * SAMPLE_PUZZLE is the 4x4 fixture:
 *   solution 1 2 3 4 / 2 1 4 3 / 3 4 1 2 / 4 3 2 1
 * Every digit appears exactly 4 times; the 1s sit at cells 0, 5, 10, 15.
 */
const SOLUTION: Grid = [...SAMPLE_PUZZLE.solution];
const EMPTY: Grid = new Array(16).fill(null);
const ONES_ONLY: Grid = EMPTY.map((_, i) => (SOLUTION[i] === 1 ? 1 : null));

function errorsOn(cells: number[] = []): GridErrors {
  return { cells: new Set(cells), duplicates: new Set(), badCages: [] };
}

describe('completedDigits', () => {
  it('retires nothing on an empty board', () => {
    expect(completedDigits(SAMPLE_PUZZLE, EMPTY, errorsOn(), [])).toEqual(new Set());
  });

  it('retires a digit once all N clean copies are placed', () => {
    expect(completedDigits(SAMPLE_PUZZLE, ONES_ONLY, errorsOn(), [])).toEqual(new Set([1]));
  });

  it('retires every digit on a fully solved board', () => {
    expect(completedDigits(SAMPLE_PUZZLE, SOLUTION, errorsOn(), [])).toEqual(new Set([1, 2, 3, 4]));
  });

  it('leaves a digit active while it is one short of N', () => {
    const partial = [...ONES_ONLY];
    partial[15] = null; // three 1s placed, not four
    expect(completedDigits(SAMPLE_PUZZLE, partial, errorsOn(), [])).toEqual(new Set());
  });

  it('does not count a copy the error checker painted red', () => {
    // All four 1s placed, but cell 0 is flagged as a conflict: clean count is 3.
    expect(completedDigits(SAMPLE_PUZZLE, ONES_ONLY, errorsOn([0]), [])).toEqual(new Set());
  });

  it('does not count a copy the Correctness check rejected', () => {
    expect(completedDigits(SAMPLE_PUZZLE, ONES_ONLY, errorsOn(), [5])).toEqual(new Set());
  });

  it('keeps a digit active when a duplicate reds both copies', () => {
    // A fifth 1 in cell 1 duplicates the 1 in cell 0 within row 0; the checker
    // reds both, so only the two untouched 1s (cells 10, 15) count.
    const dup = [...ONES_ONLY];
    dup[1] = 1;
    expect(completedDigits(SAMPLE_PUZZLE, dup, errorsOn([0, 1]), [])).toEqual(new Set());
  });
});
