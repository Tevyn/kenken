import { describe, expect, it } from 'vitest';
import type { Grid } from '../engine/types';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import type { Marks } from './state';
import { wrongNotes } from './wrongNotes';

/*
 * SAMPLE_PUZZLE is the 4x4 fixture. Cells are row-major 0..15, so cell c sits in
 * row floor(c / 4), column c % 4. The tests place values by hand and never touch
 * the solution — a wrong note is provable from the player's own board alone.
 */
const EMPTY_VALUES: Grid = new Array(16).fill(null);

function emptyMarks(): Marks {
  return Array.from({ length: 16 }, () => []);
}

describe('wrongNotes', () => {
  it('flags nothing on a board with no values placed', () => {
    const marks = emptyMarks();
    marks[2] = [3];
    marks[8] = [1, 4];
    expect(wrongNotes(SAMPLE_PUZZLE, EMPTY_VALUES, marks).every((w) => w.length === 0)).toBe(true);
  });

  it('reds a note for a digit a row peer already holds', () => {
    const values = [...EMPTY_VALUES];
    values[0] = 3; // row 0, column 0
    const marks = emptyMarks();
    marks[2] = [3]; // row 0, column 2 — same row as the placed 3
    expect(wrongNotes(SAMPLE_PUZZLE, values, marks)[2]).toEqual([3]);
  });

  it('reds a note for a digit a column peer already holds', () => {
    const values = [...EMPTY_VALUES];
    values[0] = 3; // row 0, column 0
    const marks = emptyMarks();
    marks[8] = [3]; // row 2, column 0 — same column as the placed 3
    expect(wrongNotes(SAMPLE_PUZZLE, values, marks)[8]).toEqual([3]);
  });

  it('leaves a note alone when no line peer holds the digit', () => {
    const values = [...EMPTY_VALUES];
    values[0] = 3;
    const marks = emptyMarks();
    marks[5] = [3]; // row 1, column 1 — shares neither row nor column with cell 0
    marks[2] = [2]; // same row, but a different digit
    const result = wrongNotes(SAMPLE_PUZZLE, values, marks);
    expect(result[5]).toEqual([]);
    expect(result[2]).toEqual([]);
  });

  it('reds only the offending digits within a cell, keeping the rest', () => {
    const values = [...EMPTY_VALUES];
    values[0] = 3; // row 0, column 0
    values[7] = 2; // row 1, column 3
    const marks = emptyMarks();
    marks[1] = [2, 3, 4]; // row 0, column 1: 3 clashes via row 0; 2 and 4 are free here
    expect(wrongNotes(SAMPLE_PUZZLE, values, marks)[1]).toEqual([3]);
  });

  it('does not red a note that only shares a cage with the digit', () => {
    // Cage 0 is cells [0, 1, 5]: cell 0 (row 0, col 0) and cell 5 (row 1, col 1)
    // share the cage but neither a row nor a column. A digit may legally repeat
    // inside a cage, so a note of the same digit there is not wrong.
    const values = [...EMPTY_VALUES];
    values[0] = 2; // row 0, column 0
    const marks = emptyMarks();
    marks[5] = [2]; // row 1, column 1 — same cage as cell 0, but a different line
    expect(wrongNotes(SAMPLE_PUZZLE, values, marks)[5]).toEqual([]);
  });
});
