import type { Puzzle } from '../engine/types'

/**
 * The worked 4x4 example from `docs/KENKEN.md` §1.6, and the fixture the hint
 * spec's worked examples in `docs/HINTS.md` §4 are computed against.
 *
 * Its uniqueness was established by exhaustive enumeration of all 576 order-4
 * Latin squares; `docPuzzle.test.ts` re-checks it with the engine's own solver.
 *
 * Solution:
 *   1 2 3 4
 *   3 4 1 2
 *   2 1 4 3
 *   4 3 2 1
 *
 * Cages, using the letters `docs/KENKEN.md` gives them:
 *   E 3÷ (0,4)   A 8× (1,5)   D 7+ (2,3)    B 3− (6,10)
 *   G 8× (8,12)  C 6× (9,13,14)  F 1− (7,11)  H =1 (15)
 *
 * This is a *different* puzzle from `SAMPLE_PUZZLE`, which the UI builds
 * against — the two happen to share a grid size and nothing else.
 */
export const DOC_PUZZLE: Puzzle = {
  size: 4,
  difficulty: 'easy',
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
}
