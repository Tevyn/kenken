/**
 * End-to-end acceptance tests for the whole app's core promise:
 * "generate a puzzle at any offered size and difficulty, and it is a valid,
 *  uniquely-solvable KenKen."
 *
 * These are deliberately owned by the integration layer rather than by the
 * engine's own unit tests: the UI offers every combination of size 3..9 and
 * all four difficulties, so all 28 combinations must work, even though the
 * research reference (docs/KENKEN.md section 4.2) only specifies generator
 * parameters for some of them.
 */
import { describe, it, expect } from 'vitest';
import {
  generatePuzzle,
  countSolutions,
  solvePuzzle,
  isSolved,
  findConflicts,
  cageIdByCell,
  DIFFICULTIES,
  MIN_SIZE,
  MAX_SIZE,
} from './engine';
import type { Puzzle, Grid } from './engine/types';

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i);

/** Assert a puzzle is structurally well-formed, independent of how it was made. */
function expectStructurallyValid(puzzle: Puzzle) {
  const n = puzzle.size;
  const cellCount = n * n;

  // Solution is a Latin square.
  expect(puzzle.solution).toHaveLength(cellCount);
  for (let r = 0; r < n; r++) {
    const row = new Set<number>();
    const col = new Set<number>();
    for (let c = 0; c < n; c++) {
      row.add(puzzle.solution[r * n + c]);
      col.add(puzzle.solution[c * n + r]);
    }
    expect(row.size, `row ${r} has a duplicate digit`).toBe(n);
    expect(col.size, `column ${r} has a duplicate digit`).toBe(n);
  }
  for (const v of puzzle.solution) {
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(n);
  }

  // Cages tile the grid exactly once.
  const owner = cageIdByCell(puzzle);
  expect(owner).toHaveLength(cellCount);
  expect(owner.filter((id) => id === -1)).toHaveLength(0);

  for (const cage of puzzle.cages) {
    expect(cage.cells.length).toBeGreaterThan(0);

    // Cage is orthogonally connected.
    const members = new Set(cage.cells);
    const seen = new Set<number>([cage.cells[0]]);
    const stack = [cage.cells[0]];
    while (stack.length) {
      const cell = stack.pop()!;
      const r = Math.floor(cell / n);
      const c = cell % n;
      const neighbours = [
        r > 0 ? cell - n : -1,
        r < n - 1 ? cell + n : -1,
        c > 0 ? cell - 1 : -1,
        c < n - 1 ? cell + 1 : -1,
      ];
      for (const nb of neighbours) {
        if (nb >= 0 && members.has(nb) && !seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    expect(seen.size, `cage ${cage.id} is not orthogonally connected`).toBe(cage.cells.length);

    // Operator legality and target correctness against the solution.
    const vals = cage.cells.map((i) => puzzle.solution[i]);
    switch (cage.op) {
      case '=':
        expect(cage.cells).toHaveLength(1);
        expect(cage.target).toBe(vals[0]);
        break;
      case '+':
        expect(vals.reduce((a, b) => a + b, 0)).toBe(cage.target);
        break;
      case '*':
        expect(vals.reduce((a, b) => a * b, 1)).toBe(cage.target);
        break;
      case '-':
        expect(cage.cells, 'subtraction cages must be 2 cells').toHaveLength(2);
        expect(Math.abs(vals[0] - vals[1])).toBe(cage.target);
        break;
      case '/': {
        expect(cage.cells, 'division cages must be 2 cells').toHaveLength(2);
        const hi = Math.max(...vals);
        const lo = Math.min(...vals);
        expect(hi % lo, 'division cages must divide exactly').toBe(0);
        expect(hi / lo).toBe(cage.target);
        break;
      }
    }
  }
}

describe('every size and difficulty the UI offers', () => {
  for (const size of SIZES) {
    for (const difficulty of DIFFICULTIES) {
      it(`generates a valid, uniquely-solvable ${size}x${size} ${difficulty} puzzle`, () => {
        const puzzle = generatePuzzle({
          size,
          difficulty,
          seed: `acceptance-${size}-${difficulty}`,
        });

        expect(puzzle.size).toBe(size);
        expect(puzzle.difficulty).toBe(difficulty);
        expectStructurallyValid(puzzle);

        // The single most important property of the whole app.
        expect(countSolutions(puzzle, 2)).toBe(1);

        // And the one solution is the stated one.
        const [found] = solvePuzzle(puzzle, 1);
        expect(found).toEqual(puzzle.solution);
      });
    }
  }
});

describe('puzzle reproducibility', () => {
  it('is deterministic for a given seed', () => {
    const a = generatePuzzle({ size: 6, difficulty: 'hard', seed: 'repro' });
    const b = generatePuzzle({ size: 6, difficulty: 'hard', seed: 'repro' });
    expect(b).toEqual(a);
  });

  it('produces different puzzles for different seeds', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      seen.add(JSON.stringify(generatePuzzle({ size: 5, difficulty: 'medium', seed: `s${i}` })));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('play-through semantics', () => {
  it('recognises the completed solution and nothing less', () => {
    const puzzle = generatePuzzle({ size: 5, difficulty: 'easy', seed: 'play' });
    const grid: Grid = new Array(25).fill(null);

    expect(isSolved(puzzle, grid)).toBe(false);
    for (let i = 0; i < 25; i++) {
      grid[i] = puzzle.solution[i];
      // Only the very last cell should complete it.
      expect(isSolved(puzzle, grid)).toBe(i === 24);
    }
  });

  it('reports no conflicts for a correct partial grid', () => {
    const puzzle = generatePuzzle({ size: 5, difficulty: 'easy', seed: 'play' });
    const grid: Grid = new Array(25).fill(null);
    for (let i = 0; i < 12; i++) grid[i] = puzzle.solution[i];
    expect([...findConflicts(puzzle, grid)]).toEqual([]);
  });

  it('flags a duplicate digit in a row', () => {
    const puzzle = generatePuzzle({ size: 5, difficulty: 'easy', seed: 'play' });
    const grid: Grid = new Array(25).fill(null);
    grid[0] = puzzle.solution[0];
    grid[1] = puzzle.solution[0]; // duplicate within row 0
    const conflicts = findConflicts(puzzle, grid);
    expect(conflicts.has(0)).toBe(true);
    expect(conflicts.has(1)).toBe(true);
  });

  it('never flags empty cells', () => {
    const puzzle = generatePuzzle({ size: 4, difficulty: 'easy', seed: 'play' });
    const grid: Grid = new Array(16).fill(null);
    grid[0] = 1;
    grid[1] = 1;
    for (const cell of findConflicts(puzzle, grid)) {
      expect(grid[cell]).not.toBeNull();
    }
  });
});

describe('input validation', () => {
  it('rejects sizes outside the supported range', () => {
    expect(() => generatePuzzle({ size: 2, difficulty: 'easy' })).toThrow(RangeError);
    expect(() => generatePuzzle({ size: 10, difficulty: 'easy' })).toThrow(RangeError);
  });

  it('generates without an explicit seed', () => {
    const puzzle = generatePuzzle({ size: 4, difficulty: 'easy' });
    expect(puzzle.seed).toBeTruthy();
    expect(countSolutions(puzzle, 2)).toBe(1);
  });
});
