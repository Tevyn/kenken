import { describe, expect, it } from 'vitest';
import type { GridErrors } from '../engine/errors';
import type { Grid } from '../engine/types';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import {
  CAGE_STEP_MS,
  LINE_STEP_MS,
  cleanCompleteUnits,
  computeGlowDelays,
  singleForwardEdit,
} from './completionGlow';

/*
 * SAMPLE_PUZZLE is the 4x4 fixture:
 *   solution 1 2 3 4 / 2 1 4 3 / 3 4 1 2 / 4 3 2 1
 *   cages    0:[0,1,5] 1:[2,3,7] 2:[4,8] 3:[6,10] 4:[9,12,13] 5:[11,15] 6:[14]
 */
const SOLUTION: Grid = [...SAMPLE_PUZZLE.solution];
const EMPTY: Grid = new Array(16).fill(null);

function noErrors(cells: number[] = []): GridErrors {
  return { cells: new Set(cells), duplicates: new Set(), badCages: [] };
}

describe('singleForwardEdit', () => {
  it('returns the one cell a placement filled', () => {
    const before = [...EMPTY];
    const after = [...EMPTY];
    after[6] = 3;
    expect(singleForwardEdit(before, after)).toBe(6);
  });

  it('accepts an overwrite of an existing value', () => {
    const before = [...EMPTY];
    before[6] = 2;
    const after = [...before];
    after[6] = 3;
    expect(singleForwardEdit(before, after)).toBe(6);
  });

  it('rejects an erase (cell cleared, not filled)', () => {
    const before = [...EMPTY];
    before[6] = 3;
    const after = [...before];
    after[6] = null;
    expect(singleForwardEdit(before, after)).toBeNull();
  });

  it('rejects a multi-cell change (undo, reset, hint burst)', () => {
    const before = [...EMPTY];
    const after = [...EMPTY];
    after[0] = 1;
    after[1] = 2;
    expect(singleForwardEdit(before, after)).toBeNull();
  });

  it('rejects an identical grid and a length mismatch', () => {
    expect(singleForwardEdit(EMPTY, [...EMPTY])).toBeNull();
    expect(singleForwardEdit(EMPTY, new Array(9).fill(null))).toBeNull();
  });
});

describe('cleanCompleteUnits', () => {
  it('finds every row, column, cage, and the whole puzzle on a solved grid', () => {
    const units = cleanCompleteUnits(SAMPLE_PUZZLE, SOLUTION, noErrors(), []);
    for (let i = 0; i < 4; i++) {
      expect(units.has(`row:${i}`)).toBe(true);
      expect(units.has(`col:${i}`)).toBe(true);
    }
    for (const cage of SAMPLE_PUZZLE.cages) expect(units.has(`cage:${cage.id}`)).toBe(true);
    expect(units.has('puzzle')).toBe(true);
    // 4 rows + 4 cols + 7 cages + 1 puzzle
    expect(units.size).toBe(16);
  });

  it('reports only the finished units on a partial grid', () => {
    // Row 0 filled correctly; nothing else.
    const values: Grid = [...EMPTY];
    values[0] = 1;
    values[1] = 2;
    values[2] = 3;
    values[3] = 4;
    const units = cleanCompleteUnits(SAMPLE_PUZZLE, values, noErrors(), []);
    expect(units.has('row:0')).toBe(true);
    expect(units.has('col:0')).toBe(false); // column 0 is not full
    expect(units.has('puzzle')).toBe(false);
    expect(units.size).toBe(1);
  });

  it('excludes a full unit that carries a conflict', () => {
    const values: Grid = [...EMPTY];
    values[0] = 1;
    values[1] = 2;
    values[2] = 3;
    values[3] = 4;
    // A conflict flag on a cell of row 0 keeps it out.
    const units = cleanCompleteUnits(SAMPLE_PUZZLE, values, noErrors([1]), []);
    expect(units.has('row:0')).toBe(false);
  });

  it('excludes a full unit a correctness verdict rejected', () => {
    const values: Grid = [...EMPTY];
    values[0] = 1;
    values[1] = 2;
    values[2] = 3;
    values[3] = 4;
    const units = cleanCompleteUnits(SAMPLE_PUZZLE, values, noErrors(), [2]);
    expect(units.has('row:0')).toBe(false);
  });

  it('withholds the whole-puzzle unit while any cell is red', () => {
    // A full grid, but one conflict somewhere: the finale must not fire.
    const units = cleanCompleteUnits(SAMPLE_PUZZLE, SOLUTION, noErrors([5]), []);
    expect(units.has('puzzle')).toBe(false);
  });
});

describe('computeGlowDelays', () => {
  it('sweeps a row outward from the placed cell at the line step', () => {
    // Origin at cell 0 (row 0, col 0); row 0 = cells 0..3.
    const delays = computeGlowDelays(SAMPLE_PUZZLE, 0, ['row:0']);
    expect(delays.get(0)).toBe(0);
    expect(delays.get(1)).toBe(1 * LINE_STEP_MS);
    expect(delays.get(2)).toBe(2 * LINE_STEP_MS);
    expect(delays.get(3)).toBe(3 * LINE_STEP_MS);
    expect(delays.size).toBe(4);
  });

  it('radiates a cage by Manhattan distance at the cage step', () => {
    // Cage 0 = cells [0,1,5]; origin at cell 0 (r0c0).
    const delays = computeGlowDelays(SAMPLE_PUZZLE, 0, ['cage:0']);
    expect(delays.get(0)).toBe(0);
    expect(delays.get(1)).toBe(1 * CAGE_STEP_MS); // r0c1: distance 1
    expect(delays.get(5)).toBe(2 * CAGE_STEP_MS); // r1c1: distance 2
    expect(delays.size).toBe(3);
  });

  it('lights the whole grid corner-to-corner from the top-left, superseding smaller units', () => {
    const delays = computeGlowDelays(SAMPLE_PUZZLE, 10, ['puzzle', 'row:2', 'cage:3']);
    expect(delays.size).toBe(16);
    expect(delays.get(0)).toBe(0); // top-left, distance 0
    expect(delays.get(15)).toBe(6 * LINE_STEP_MS); // bottom-right, r3+c3
    // Superseded: the row/cage steps do not leak in — cell 10 (r2c2) is r+c=4.
    expect(delays.get(10)).toBe(4 * LINE_STEP_MS);
  });

  it('keeps the earlier wavefront when two units light the same cell', () => {
    // Origin cell 0; cell 1 is in both row 0 (delay 60) and cage 0 (delay 80).
    const delays = computeGlowDelays(SAMPLE_PUZZLE, 0, ['row:0', 'cage:0']);
    expect(delays.get(1)).toBe(1 * LINE_STEP_MS); // min(60, 80)
  });
});
