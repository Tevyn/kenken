import { describe, expect, it } from 'vitest';
import { cageIdByCell, colOf, indexOf, rowOf } from '../engine/types';
import { generatePuzzle } from '../engine';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import { computeCellEdges, edgeClassNames } from './cageBorders';

const cageIds = cageIdByCell(SAMPLE_PUZZLE);

/**
 * These tests deliberately derive their expectations from the puzzle's cage
 * layout rather than hard-coding cell numbers. An earlier version hard-coded
 * adjacencies from the fixture and broke wholesale when the fixture was
 * corrected, without the border logic itself being wrong.
 */
describe('computeCellEdges', () => {
  const puzzles = [
    ['sample fixture', SAMPLE_PUZZLE],
    ['generated 5x5', generatePuzzle({ size: 5, difficulty: 'medium', seed: 'borders-5' })],
    ['generated 9x9', generatePuzzle({ size: 9, difficulty: 'hard', seed: 'borders-9' })],
  ] as const;

  for (const [label, puzzle] of puzzles) {
    it(`marks a heavy edge exactly where two cages meet (${label})`, () => {
      const ids = cageIdByCell(puzzle);
      const { size } = puzzle;

      for (let index = 0; index < size * size; index++) {
        const row = rowOf(index, size);
        const col = colOf(index, size);
        const edges = computeCellEdges(puzzle, ids, index);

        expect(edges.isLastCol).toBe(col === size - 1);
        expect(edges.isLastRow).toBe(row === size - 1);

        // Independently recompute the expected answer from the cage map.
        const expectedRight = col < size - 1 && ids[index] !== ids[indexOf(row, col + 1, size)];
        const expectedBottom = row < size - 1 && ids[index] !== ids[indexOf(row + 1, col, size)];

        expect(edges.rightHeavy, `right edge of cell ${index}`).toBe(expectedRight);
        expect(edges.bottomHeavy, `bottom edge of cell ${index}`).toBe(expectedBottom);
      }
    });

    it(`never draws a heavy edge at the grid boundary (${label})`, () => {
      const ids = cageIdByCell(puzzle);
      const { size } = puzzle;
      for (let index = 0; index < size * size; index++) {
        const edges = computeCellEdges(puzzle, ids, index);
        if (edges.isLastCol) expect(edges.rightHeavy).toBe(false);
        if (edges.isLastRow) expect(edges.bottomHeavy).toBe(false);
      }
    });

    it(`draws every internal cage boundary exactly once (${label})`, () => {
      const ids = cageIdByCell(puzzle);
      const { size } = puzzle;
      let drawn = 0;
      let boundaries = 0;

      for (let index = 0; index < size * size; index++) {
        const edges = computeCellEdges(puzzle, ids, index);
        if (edges.rightHeavy) drawn++;
        if (edges.bottomHeavy) drawn++;

        const row = rowOf(index, size);
        const col = colOf(index, size);
        // Count each adjacent differing-cage pair once, from the left/top side.
        if (col < size - 1 && ids[index] !== ids[indexOf(row, col + 1, size)]) boundaries++;
        if (row < size - 1 && ids[index] !== ids[indexOf(row + 1, col, size)]) boundaries++;
      }

      expect(drawn).toBe(boundaries);
      expect(boundaries).toBeGreaterThan(0);
    });
  }

  it('does not mark an edge between two cells of the same cage', () => {
    // Find a real intra-cage horizontal adjacency in the fixture.
    const cage = SAMPLE_PUZZLE.cages.find((c) =>
      c.cells.some((cell) => c.cells.includes(cell + 1) && colOf(cell, 4) < 3),
    );
    expect(cage, 'fixture should contain a horizontal intra-cage pair').toBeDefined();

    const left = cage!.cells.find((cell) => cage!.cells.includes(cell + 1) && colOf(cell, 4) < 3)!;
    expect(computeCellEdges(SAMPLE_PUZZLE, cageIds, left).rightHeavy).toBe(false);
  });
});

describe('edgeClassNames', () => {
  it('uses edge classes at the grid boundary and cage classes inside it', () => {
    const bottomRight = computeCellEdges(SAMPLE_PUZZLE, cageIds, 15);
    expect(edgeClassNames(bottomRight)).toBe('kk-cell--edge-r kk-cell--edge-b');
  });

  it('emits a class for each heavy edge and nothing for a cell inside a cage', () => {
    expect(
      edgeClassNames({
        rightHeavy: true,
        bottomHeavy: true,
        isLastCol: false,
        isLastRow: false,
      }),
    ).toBe('kk-cell--cage-r kk-cell--cage-b');

    expect(
      edgeClassNames({
        rightHeavy: false,
        bottomHeavy: false,
        isLastCol: false,
        isLastRow: false,
      }),
    ).toBe('');

    expect(
      edgeClassNames({
        rightHeavy: true,
        bottomHeavy: false,
        isLastCol: false,
        isLastRow: false,
      }),
    ).toBe('kk-cell--cage-r');
  });

  it('prefers the board-frame class over the cage class at the boundary', () => {
    expect(
      edgeClassNames({
        rightHeavy: false,
        bottomHeavy: false,
        isLastCol: true,
        isLastRow: true,
      }),
    ).toBe('kk-cell--edge-r kk-cell--edge-b');
  });
});
