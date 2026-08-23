import { describe, expect, it } from 'vitest'
import { CAGE_LAYOUTS, cageLayout } from './cageLayouts'
import { generatePuzzle } from '../engine'
import { cageIdByCell } from '../engine/types'
import { isConnected } from '../engine/cages'
import { DIFFICULTIES, MAX_SIZE, MIN_SIZE } from '../engine/types'
import type { Difficulty } from '../engine/types'

/** Renumber cage ids into reading order, mirroring how CAGE_LAYOUTS was baked. */
function renumberReadingOrder(rawIds: readonly number[]): number[] {
  const remap = new Map<number, number>()
  const out: number[] = new Array(rawIds.length)
  for (let i = 0; i < rawIds.length; i++) {
    const raw = rawIds[i]
    let mapped = remap.get(raw)
    if (mapped === undefined) {
      mapped = remap.size
      remap.set(raw, mapped)
    }
    out[i] = mapped
  }
  return out
}

describe('CAGE_LAYOUTS coverage', () => {
  it('has exactly one entry per size x difficulty permutation', () => {
    expect(CAGE_LAYOUTS).toHaveLength((MAX_SIZE - MIN_SIZE + 1) * DIFFICULTIES.length)

    const seen = new Set<string>()
    for (const layout of CAGE_LAYOUTS) {
      const key = `${layout.size}/${layout.difficulty}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
    for (let size = MIN_SIZE; size <= MAX_SIZE; size++) {
      for (const difficulty of DIFFICULTIES) {
        expect(seen.has(`${size}/${difficulty}`)).toBe(true)
      }
    }
  })

  it('is ordered by size then by DIFFICULTIES order', () => {
    let index = 0
    for (let size = MIN_SIZE; size <= MAX_SIZE; size++) {
      for (const difficulty of DIFFICULTIES) {
        expect(CAGE_LAYOUTS[index].size).toBe(size)
        expect(CAGE_LAYOUTS[index].difficulty).toBe(difficulty)
        index++
      }
    }
  })
})

describe('CAGE_LAYOUTS structure', () => {
  it.each(CAGE_LAYOUTS.map((l) => [l.size, l.difficulty] as [number, Difficulty]))(
    'size %i, %s cage ids are well formed',
    (size, difficulty) => {
      const layout = cageLayout(size, difficulty)

      // Correct length.
      expect(layout.cageIds).toHaveLength(size * size)

      // Ids are exactly 0..max with no gaps, and appear in reading order: the
      // first occurrence of id k must precede the first occurrence of id k+1.
      let nextExpectedId = 0
      const firstSeenAt = new Map<number, number>()
      for (let i = 0; i < layout.cageIds.length; i++) {
        const id = layout.cageIds[i]
        if (!firstSeenAt.has(id)) {
          expect(id).toBe(nextExpectedId)
          firstSeenAt.set(id, i)
          nextExpectedId++
        }
      }
      // No gaps: ids present are exactly 0..nextExpectedId-1.
      expect(new Set(layout.cageIds)).toEqual(new Set(Array.from({ length: nextExpectedId }, (_u, i) => i)))

      // Every cage's cells are orthogonally connected.
      const cageCount = nextExpectedId
      for (let cageId = 0; cageId < cageCount; cageId++) {
        const cells: number[] = []
        for (let i = 0; i < layout.cageIds.length; i++) {
          if (layout.cageIds[i] === cageId) cells.push(i)
        }
        expect(cells.length).toBeGreaterThan(0)
        expect(isConnected(cells, size)).toBe(true)
      }
    },
  )
})

/**
 * Regenerating from the recorded seed must reproduce the baked `cageIds`
 * exactly, after the same reading-order renumbering used to bake the file.
 * This is the guarantee the file-level doc comment promises.
 *
 * 8x8/9x9 expert generation is the slowest corner of the generator (see
 * `docs/KENKEN.md` §3.3 on 5-cell cage combination cost), and re-running it
 * here for every one of the 28 layouts would make this suite noticeably
 * slower for marginal benefit: the round trip only exercises determinism,
 * which `generator.test.ts` already covers exhaustively across every size and
 * several seeds. So the full round trip below is limited to sizes 3..6, which
 * is enough to catch drift in the renumbering logic or a change to seed
 * derivation; larger sizes still get every other structural check above.
 */
describe('CAGE_LAYOUTS regeneration round-trip', () => {
  const roundTrippable = CAGE_LAYOUTS.filter((l) => l.size <= 6)

  it.each(roundTrippable.map((l) => [l.size, l.difficulty] as [number, Difficulty]))(
    'size %i, %s reproduces its baked cageIds from its seed',
    (size, difficulty) => {
      const layout = cageLayout(size, difficulty)
      const puzzle = generatePuzzle({ size, difficulty, seed: layout.seed })
      const regenerated = renumberReadingOrder(cageIdByCell(puzzle))
      expect(regenerated).toEqual(layout.cageIds)
    },
    30_000,
  )
})

describe('cageLayout lookup', () => {
  it('throws a RangeError for an unsupported size', () => {
    expect(() => cageLayout(2, 'easy')).toThrow(RangeError)
    expect(() => cageLayout(10, 'easy')).toThrow(RangeError)
  })

  it('throws a RangeError for an unknown difficulty', () => {
    expect(() => cageLayout(4, 'impossible' as Difficulty)).toThrow(RangeError)
  })

  it('returns the matching layout', () => {
    const layout = cageLayout(5, 'hard')
    expect(layout.size).toBe(5)
    expect(layout.difficulty).toBe('hard')
  })
})
