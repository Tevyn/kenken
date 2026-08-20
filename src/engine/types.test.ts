import { describe, expect, it } from 'vitest'
import { cageAnchor, cageIdByCell, cageLabel, colOf, indexOf, rowOf } from './types'
import type { Cage, Puzzle } from './types'
import { generatePuzzle } from './index'

const cage = (over: Partial<Cage>): Cage => ({
  id: 0,
  cells: [0, 1],
  op: '+',
  target: 5,
  ...over,
})

describe('cageLabel', () => {
  it('prints the conventional KenKen operator glyphs', () => {
    expect(cageLabel(cage({ op: '+', target: 12 }))).toBe('12+')
    expect(cageLabel(cage({ op: '-', target: 3 }))).toBe('3−')
    expect(cageLabel(cage({ op: '*', target: 48 }))).toBe('48×')
    expect(cageLabel(cage({ op: '/', target: 2 }))).toBe('2÷')
  })

  it('prints a bare number for a single-cell freebie', () => {
    expect(cageLabel(cage({ op: '=', cells: [4], target: 5 }))).toBe('5')
  })

  it('never emits ASCII * or / to the player', () => {
    const puzzle = generatePuzzle({ size: 7, difficulty: 'hard', seed: 'glyphs' })
    for (const c of puzzle.cages) {
      expect(cageLabel(c)).not.toMatch(/[*/]/)
    }
  })
})

describe('coordinate helpers', () => {
  it('round-trip between index and row/col', () => {
    for (const size of [3, 5, 9]) {
      for (let index = 0; index < size * size; index++) {
        expect(indexOf(rowOf(index, size), colOf(index, size), size)).toBe(index)
      }
    }
  })
})

describe('cageIdByCell', () => {
  it('assigns every cell to exactly one cage', () => {
    const puzzle: Puzzle = generatePuzzle({ size: 6, difficulty: 'medium', seed: 'owner' })
    const owner = cageIdByCell(puzzle)
    expect(owner).toHaveLength(36)
    expect(owner.some((id) => id === -1)).toBe(false)
    for (const c of puzzle.cages) {
      for (const cell of c.cells) expect(owner[cell]).toBe(c.id)
    }
  })
})

describe('cageAnchor', () => {
  it('is the top-left-most cell, where the label is drawn', () => {
    // Cells are contractually sorted, but a mis-ordered cage must still anchor
    // at its top-left cell rather than wherever cells[0] happens to point.
    expect(cageAnchor(cage({ cells: [2, 5, 9] }))).toBe(2)
    expect(cageAnchor(cage({ cells: [5, 2, 9] }))).toBe(2)
    const puzzle = generatePuzzle({ size: 5, difficulty: 'easy', seed: 'anchor' })
    for (const c of puzzle.cages) {
      expect(cageAnchor(c)).toBe(Math.min(...c.cells))
    }
  })
})
