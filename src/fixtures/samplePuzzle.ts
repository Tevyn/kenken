import type { Puzzle } from '../engine/types'

/**
 * A hand-written 4x4 puzzle used for UI development and rendering tests, so the
 * UI can be built before/independently of the generator.
 *
 * Solution:
 *   1 2 3 4
 *   2 1 4 3
 *   3 4 1 2
 *   4 3 2 1
 *
 * NOTE: uniqueness of this puzzle is asserted by an engine test
 * (`countSolutions(SAMPLE_PUZZLE) === 1`). If that test fails, replace this
 * fixture with a generated, verified puzzle rather than deleting the assertion.
 */
export const SAMPLE_PUZZLE: Puzzle = {
  size: 4,
  difficulty: 'easy',
  seed: 'sample-4x4',
  solution: [1, 2, 3, 4, 2, 1, 4, 3, 3, 4, 1, 2, 4, 3, 2, 1],
  cages: [
    { id: 0, cells: [0, 4], op: '-', target: 1 },
    { id: 1, cells: [1, 2], op: '+', target: 5 },
    { id: 2, cells: [3, 7], op: '+', target: 7 },
    { id: 3, cells: [5, 6], op: '*', target: 4 },
    { id: 4, cells: [8, 12], op: '+', target: 7 },
    { id: 5, cells: [9, 10], op: '-', target: 3 },
    { id: 6, cells: [11, 15], op: '-', target: 1 },
    { id: 7, cells: [13, 14], op: '+', target: 5 },
  ],
}
