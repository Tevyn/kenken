import { describe, expect, it } from 'vitest';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import { countSolutions, isSolved, solvePuzzle } from './index';
import { cageSatisfied, isConnected } from './cages';

/**
 * The UI builds against this fixture, so it has to be a real puzzle: exactly
 * one solution, and that solution has to be the one the file documents.
 *
 * The fixture originally shipped a hand-written cage layout that turned out to
 * admit four solutions (the row-swap symmetry `docs/KENKEN.md` §1.6 warns
 * about). Its cages were replaced with a machine-verified set over the same
 * documented solution grid.
 */
describe('SAMPLE_PUZZLE', () => {
  it('has exactly one solution', () => {
    expect(countSolutions(SAMPLE_PUZZLE, 2)).toBe(1);
  });

  it('solves to its stated solution', () => {
    const solutions = solvePuzzle(SAMPLE_PUZZLE, 2);
    expect(solutions).toHaveLength(1);
    expect(solutions[0]).toEqual(SAMPLE_PUZZLE.solution);
  });

  it('matches the solution grid in its own doc comment', () => {
    expect(SAMPLE_PUZZLE.solution).toEqual([1, 2, 3, 4, 2, 1, 4, 3, 3, 4, 1, 2, 4, 3, 2, 1]);
  });

  it('is recognised as solved by the stated solution', () => {
    expect(isSolved(SAMPLE_PUZZLE, SAMPLE_PUZZLE.solution)).toBe(true);
  });

  it('tiles the 4x4 grid with connected cages', () => {
    const seen = new Set<number>();
    SAMPLE_PUZZLE.cages.forEach((cage, index) => {
      expect(cage.id).toBe(index);
      expect(isConnected(cage.cells, SAMPLE_PUZZLE.size)).toBe(true);
      expect(cage.cells.slice().sort((a, b) => a - b)).toEqual(cage.cells);
      for (const cell of cage.cells) {
        expect(seen.has(cell)).toBe(false);
        seen.add(cell);
      }
    });
    expect(seen.size).toBe(16);
  });

  it('has cage arithmetic consistent with the solution', () => {
    for (const cage of SAMPLE_PUZZLE.cages) {
      expect(cageSatisfied(cage, cage.cells.map((c) => SAMPLE_PUZZLE.solution[c]))).toBe(true);
    }
  });

  it('shows off every operator, which is why the UI uses it', () => {
    expect(new Set(SAMPLE_PUZZLE.cages.map((c) => c.op))).toEqual(new Set(['+', '-', '*', '/', '=']));
  });
});
