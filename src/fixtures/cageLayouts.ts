/**
 * Baked cage layouts for the New Game wizard's difficulty icons.
 *
 * Each difficulty button in the wizard draws a tiny grid icon showing that
 * size/difficulty's characteristic cage shapes (easy: big loose cages, expert:
 * tight small ones). Those shapes have to come from a REAL generated puzzle —
 * anything hand-drawn or synthesized would misrepresent what the generator
 * actually produces, and the whole point of the icon is to preview it.
 *
 * They are baked at author time rather than generated on the fly because:
 *   - the wizard needs all 28 (size x difficulty) icons visible at once, and
 *     running the generator 28 times on every render (or even once, on mount)
 *     is wasted work for data that never changes;
 *   - a build-time constant is trivially fast and requires no loading state;
 *   - baking makes the exact icon shown reviewable in a diff, the same way
 *     `samplePuzzle.ts` bakes a fixture instead of generating one at import
 *     time.
 *
 * Each entry's `cageIds` is `cageIdByCell(generatePuzzle({ size, difficulty,
 * seed }))`, with the generator's cage ids renumbered into reading order
 * (first cell 0..n-1 encountered gets id 0, 1, 2, ...) so the baked data is
 * canonical and diff-stable regardless of the order the generator happened to
 * assign ids in.
 *
 * To regenerate (e.g. after an engine change alters generation): write a
 * throwaway script/test that calls `generatePuzzle({ size, difficulty, seed })`
 * for each entry below using its recorded `seed`, applies the same
 * reading-order renumbering via `cageIdByCell`, and diffs the result against
 * this file. Every entry here was produced with the default seed pattern
 * `icon-${size}-${difficulty}`; none needed a fallback seed. See
 * `cageLayouts.test.ts` for the round-trip check that keeps this guarantee
 * honest.
 */

import type { Difficulty } from '../engine/types'

export interface CageLayout {
  size: number
  difficulty: Difficulty
  /** The seed that produced this puzzle; regenerating with it reproduces `cageIds`. */
  seed: string
  /** `cageIds[i]` is the cage id of cell `i`. Length `size * size`. Ids are 0..cageCount-1 in reading order. */
  cageIds: readonly number[]
}

/** All 28 baked layouts, ordered by size then by DIFFICULTIES order. */
export const CAGE_LAYOUTS: readonly CageLayout[] = [
  {
    size: 3,
    difficulty: 'easy',
    seed: 'icon-3-easy',
    cageIds: [
      0, 0, 1,
      2, 3, 1,
      2, 3, 4,
    ],
  },
  {
    size: 3,
    difficulty: 'medium',
    seed: 'icon-3-medium',
    cageIds: [
      0, 0, 1,
      2, 1, 1,
      2, 3, 3,
    ],
  },
  {
    size: 3,
    difficulty: 'hard',
    seed: 'icon-3-hard',
    cageIds: [
      0, 1, 1,
      0, 1, 2,
      3, 3, 2,
    ],
  },
  {
    size: 3,
    difficulty: 'expert',
    seed: 'icon-3-expert',
    cageIds: [
      0, 0, 1,
      0, 2, 1,
      2, 2, 1,
    ],
  },
  {
    size: 4,
    difficulty: 'easy',
    seed: 'icon-4-easy',
    cageIds: [
      0, 1, 1, 2,
      0, 3, 4, 4,
      5, 3, 6, 7,
      8, 8, 6, 7,
    ],
  },
  {
    size: 4,
    difficulty: 'medium',
    seed: 'icon-4-medium',
    cageIds: [
      0, 1, 1, 2,
      0, 3, 2, 2,
      0, 3, 4, 5,
      6, 6, 4, 4,
    ],
  },
  {
    size: 4,
    difficulty: 'hard',
    seed: 'icon-4-hard',
    cageIds: [
      0, 0, 1, 1,
      2, 2, 3, 3,
      4, 2, 5, 3,
      4, 4, 5, 5,
    ],
  },
  {
    size: 4,
    difficulty: 'expert',
    seed: 'icon-4-expert',
    cageIds: [
      0, 0, 1, 1,
      2, 0, 0, 1,
      2, 2, 3, 3,
      4, 4, 3, 3,
    ],
  },
  {
    size: 5,
    difficulty: 'easy',
    seed: 'icon-5-easy',
    cageIds: [
      0, 0, 1, 1, 2,
      0, 3, 4, 5, 6,
      7, 8, 4, 9, 6,
      7, 8, 8, 9, 10,
      11, 11, 12, 12, 10,
    ],
  },
  {
    size: 5,
    difficulty: 'medium',
    seed: 'icon-5-medium',
    cageIds: [
      0, 1, 1, 2, 3,
      0, 0, 4, 4, 3,
      5, 6, 6, 7, 7,
      8, 6, 9, 9, 7,
      8, 8, 9, 10, 10,
    ],
  },
  {
    size: 5,
    difficulty: 'hard',
    seed: 'icon-5-hard',
    cageIds: [
      0, 1, 1, 1, 2,
      0, 3, 4, 2, 2,
      0, 3, 4, 5, 5,
      6, 6, 4, 7, 7,
      6, 6, 8, 8, 7,
    ],
  },
  {
    size: 5,
    difficulty: 'expert',
    seed: 'icon-5-expert',
    cageIds: [
      0, 0, 1, 1, 2,
      3, 3, 4, 1, 2,
      3, 4, 4, 2, 2,
      5, 5, 4, 6, 6,
      5, 7, 7, 6, 6,
    ],
  },
  {
    size: 6,
    difficulty: 'easy',
    seed: 'icon-6-easy',
    cageIds: [
      0, 1, 2, 2, 2, 3,
      0, 1, 4, 5, 5, 3,
      6, 6, 7, 8, 8, 8,
      9, 9, 7, 10, 11, 12,
      13, 14, 14, 14, 11, 15,
      16, 16, 17, 17, 15, 15,
    ],
  },
  {
    size: 6,
    difficulty: 'medium',
    seed: 'icon-6-medium',
    cageIds: [
      0, 0, 1, 1, 2, 3,
      0, 4, 4, 1, 2, 3,
      5, 6, 6, 6, 7, 7,
      8, 8, 9, 9, 7, 10,
      11, 12, 12, 9, 10, 10,
      11, 13, 12, 14, 14, 14,
    ],
  },
  {
    size: 6,
    difficulty: 'hard',
    seed: 'icon-6-hard',
    cageIds: [
      0, 0, 0, 1, 2, 2,
      3, 3, 4, 1, 5, 5,
      6, 7, 4, 1, 1, 5,
      6, 7, 8, 8, 8, 9,
      6, 7, 10, 10, 10, 9,
      11, 11, 10, 12, 12, 12,
    ],
  },
  {
    size: 6,
    difficulty: 'expert',
    seed: 'icon-6-expert',
    cageIds: [
      0, 0, 0, 1, 2, 2,
      0, 3, 1, 1, 2, 4,
      0, 3, 5, 5, 5, 4,
      3, 3, 3, 6, 4, 4,
      7, 7, 7, 6, 6, 8,
      7, 7, 9, 9, 6, 8,
    ],
  },
  {
    size: 7,
    difficulty: 'easy',
    seed: 'icon-7-easy',
    cageIds: [
      0, 0, 1, 1, 2, 3, 3,
      4, 5, 6, 2, 2, 3, 7,
      4, 8, 6, 9, 10, 11, 7,
      12, 12, 13, 14, 14, 11, 15,
      16, 17, 17, 14, 18, 19, 15,
      16, 16, 17, 20, 18, 21, 21,
      22, 23, 23, 20, 24, 24, 24,
    ],
  },
  {
    size: 7,
    difficulty: 'medium',
    seed: 'icon-7-medium',
    cageIds: [
      0, 0, 1, 2, 2, 3, 3,
      4, 0, 5, 5, 6, 7, 7,
      4, 8, 8, 5, 6, 9, 10,
      11, 12, 12, 13, 6, 9, 14,
      11, 15, 15, 13, 13, 16, 14,
      17, 17, 15, 13, 18, 16, 19,
      20, 20, 21, 21, 18, 16, 19,
    ],
  },
  {
    size: 7,
    difficulty: 'hard',
    seed: 'icon-7-hard',
    cageIds: [
      0, 0, 1, 1, 2, 2, 2,
      3, 4, 4, 5, 5, 6, 2,
      3, 7, 7, 7, 5, 6, 8,
      9, 9, 10, 10, 10, 6, 8,
      9, 9, 11, 11, 11, 11, 8,
      12, 12, 12, 13, 13, 14, 14,
      15, 15, 15, 13, 16, 16, 14,
    ],
  },
  {
    size: 7,
    difficulty: 'expert',
    seed: 'icon-7-expert',
    cageIds: [
      0, 1, 1, 2, 2, 3, 3,
      0, 1, 1, 4, 3, 3, 5,
      0, 0, 4, 4, 4, 5, 5,
      6, 0, 4, 7, 7, 8, 8,
      6, 6, 9, 10, 8, 8, 11,
      12, 12, 9, 10, 13, 14, 11,
      12, 12, 12, 13, 13, 14, 11,
    ],
  },
  {
    size: 8,
    difficulty: 'easy',
    seed: 'icon-8-easy',
    cageIds: [
      0, 1, 2, 3, 3, 3, 4, 5,
      0, 6, 2, 7, 7, 8, 9, 5,
      10, 6, 11, 11, 12, 12, 9, 13,
      14, 15, 11, 16, 17, 18, 19, 13,
      20, 15, 21, 22, 22, 18, 23, 23,
      20, 24, 21, 25, 22, 26, 27, 27,
      28, 29, 30, 25, 31, 32, 32, 33,
      28, 29, 34, 34, 31, 35, 32, 33,
    ],
  },
  {
    size: 8,
    difficulty: 'medium',
    seed: 'icon-8-medium',
    cageIds: [
      0, 1, 1, 1, 2, 3, 4, 4,
      0, 0, 5, 5, 3, 3, 6, 7,
      8, 9, 10, 11, 11, 12, 6, 7,
      8, 9, 10, 13, 11, 12, 12, 14,
      15, 9, 13, 13, 16, 16, 17, 14,
      15, 15, 13, 18, 18, 19, 20, 14,
      21, 22, 23, 23, 24, 25, 20, 26,
      21, 22, 23, 24, 24, 25, 25, 26,
    ],
  },
  {
    size: 8,
    difficulty: 'hard',
    seed: 'icon-8-hard',
    cageIds: [
      0, 0, 1, 2, 2, 3, 3, 3,
      0, 0, 1, 1, 2, 4, 4, 5,
      6, 7, 1, 8, 9, 4, 4, 5,
      6, 7, 10, 8, 9, 11, 12, 12,
      13, 7, 10, 8, 11, 11, 12, 14,
      13, 15, 16, 16, 16, 17, 14, 14,
      13, 15, 18, 19, 19, 17, 17, 20,
      13, 18, 18, 21, 21, 20, 20, 20,
    ],
  },
  {
    size: 8,
    difficulty: 'expert',
    seed: 'icon-8-expert',
    cageIds: [
      0, 1, 1, 2, 3, 3, 4, 4,
      0, 5, 1, 2, 6, 3, 4, 7,
      5, 5, 8, 2, 6, 9, 7, 7,
      5, 10, 8, 11, 11, 9, 12, 13,
      10, 10, 11, 11, 11, 9, 12, 13,
      10, 14, 14, 15, 15, 15, 12, 13,
      16, 14, 17, 17, 18, 15, 15, 19,
      16, 16, 20, 20, 18, 19, 19, 19,
    ],
  },
  {
    size: 9,
    difficulty: 'easy',
    seed: 'icon-9-easy',
    cageIds: [
      0, 0, 1, 1, 2, 3, 4, 5, 6,
      7, 8, 8, 1, 2, 4, 4, 5, 6,
      9, 10, 10, 11, 12, 13, 13, 5, 6,
      9, 14, 15, 16, 12, 17, 18, 19, 20,
      21, 14, 14, 22, 22, 23, 18, 24, 24,
      21, 25, 26, 27, 28, 28, 29, 29, 24,
      30, 25, 26, 31, 32, 33, 33, 29, 34,
      30, 35, 31, 31, 36, 36, 37, 37, 38,
      39, 39, 40, 40, 40, 41, 41, 41, 38,
    ],
  },
  {
    size: 9,
    difficulty: 'medium',
    seed: 'icon-9-medium',
    cageIds: [
      0, 1, 2, 2, 3, 4, 4, 5, 6,
      0, 1, 1, 2, 3, 7, 7, 5, 8,
      9, 9, 10, 3, 3, 11, 11, 11, 8,
      12, 12, 10, 13, 14, 14, 15, 15, 15,
      12, 13, 13, 13, 16, 17, 18, 18, 15,
      19, 20, 21, 22, 16, 17, 23, 24, 24,
      19, 20, 22, 22, 25, 25, 23, 26, 26,
      27, 20, 28, 29, 30, 30, 30, 31, 32,
      33, 33, 28, 29, 34, 34, 31, 31, 32,
    ],
  },
  {
    size: 9,
    difficulty: 'hard',
    seed: 'icon-9-hard',
    cageIds: [
      0, 1, 2, 3, 3, 3, 4, 5, 5,
      0, 1, 2, 6, 6, 4, 4, 7, 5,
      8, 8, 2, 9, 6, 6, 10, 7, 5,
      11, 8, 9, 9, 12, 12, 10, 10, 13,
      11, 11, 14, 14, 15, 15, 16, 10, 13,
      17, 18, 18, 19, 20, 15, 16, 16, 13,
      17, 17, 21, 19, 20, 22, 22, 23, 23,
      24, 25, 21, 20, 20, 22, 26, 23, 23,
      24, 25, 27, 27, 26, 26, 26, 28, 28,
    ],
  },
  {
    size: 9,
    difficulty: 'expert',
    seed: 'icon-9-expert',
    cageIds: [
      0, 1, 1, 2, 3, 3, 4, 5, 5,
      0, 0, 0, 2, 3, 3, 4, 4, 5,
      0, 6, 7, 7, 8, 8, 4, 4, 9,
      10, 6, 6, 6, 8, 11, 9, 9, 9,
      10, 12, 12, 12, 11, 11, 13, 14, 14,
      10, 15, 16, 12, 17, 13, 13, 14, 18,
      15, 15, 16, 17, 17, 19, 19, 18, 18,
      20, 16, 16, 17, 17, 21, 19, 22, 18,
      20, 20, 23, 23, 21, 21, 22, 22, 18,
    ],
  },
]

/** Look up one layout. Throws a RangeError for an unsupported size or difficulty. */
export function cageLayout(size: number, difficulty: Difficulty): CageLayout {
  const found = CAGE_LAYOUTS.find((l) => l.size === size && l.difficulty === difficulty)
  if (!found) {
    throw new RangeError(`No baked cage layout for size=${size} difficulty=${String(difficulty)}`)
  }
  return found
}
