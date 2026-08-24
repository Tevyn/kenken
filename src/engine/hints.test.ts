import { describe, expect, it } from 'vitest';
import {
  ENABLED_TECHNIQUES,
  TECHNIQUE_RANK,
  checkCorrectness,
  detectContext,
  detectorFor,
  findHint,
  findNextNumber,
  hintSignature,
  revealHint,
  visibleSets,
  type Hint,
  type MarkSets,
  type TechniqueId,
} from './hints';
import { generatePuzzle } from './generator';
import { makeRng } from './rng';
import { DOC_PUZZLE } from '../fixtures/docPuzzle';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import { DIFFICULTIES, type Difficulty, type Grid, type Op, type Puzzle } from './types';

/* ------------------------------------------------------------------ */
/* Harness                                                              */
/* ------------------------------------------------------------------ */

const empty = (size: number): Grid => new Array<number | null>(size * size).fill(null);
const noMarks = (size: number): number[][] =>
  Array.from({ length: size * size }, () => [] as number[]);

/** A hand-built layout, checked for full coverage so a typo cannot pass quietly. */
function tiled(size: number, cages: Array<[number[], Op, number]>): Puzzle {
  const covered = new Set(cages.flatMap(([cells]) => cells));
  if (covered.size !== size * size) throw new Error(`layout covers ${covered.size} cells`);
  return {
    size,
    difficulty: 'easy',
    seed: 'hints-test',
    solution: [],
    cages: cages.map(([cells, op, target], id) => ({ id, cells, op, target })),
  };
}

/** Run one detector on its own, per the §9.1 contract. */
function detect(
  id: TechniqueId,
  puzzle: Puzzle,
  values: Grid = empty(puzzle.size),
  marks: MarkSets = noMarks(puzzle.size),
): Hint[] {
  const detector = detectorFor(id);
  if (!detector) throw new Error(`no detector for ${id}`);
  return detector(detectContext(puzzle, values, marks));
}

const withValues = (size: number, entries: Record<number, number>): Grid => {
  const grid = empty(size);
  for (const [cell, value] of Object.entries(entries)) grid[Number(cell)] = value;
  return grid;
};

/**
 * Apply a hint the way `docs/HINTS.md` §7.2 says the reducer will: a placement
 * writes values and tidies peer marks, an elimination fills bare marks from
 * `visible` first so the player can see what was crossed off.
 */
function applyHint(
  puzzle: Puzzle,
  values: Grid,
  marks: number[][],
  hint: Hint,
): { values: Grid; marks: number[][] } {
  const nextValues = values.slice();
  const nextMarks = marks.map((m) => m.slice());
  if (hint.apply.kind === 'place') {
    for (const { cell, value } of hint.apply.cells) {
      nextValues[cell] = value;
      nextMarks[cell] = [];
      const row = Math.floor(cell / puzzle.size);
      const col = cell % puzzle.size;
      for (let k = 0; k < puzzle.size; k++) {
        for (const peer of [row * puzzle.size + k, k * puzzle.size + col]) {
          nextMarks[peer] = nextMarks[peer].filter((d) => d !== value);
        }
      }
    }
  } else {
    const visible = visibleSets(puzzle, values, marks);
    for (const { cell, digits } of hint.apply.cells) {
      const base = nextMarks[cell].length > 0 ? nextMarks[cell] : visible[cell];
      nextMarks[cell] = base.filter((d) => !digits.includes(d));
    }
  }
  return { values: nextValues, marks: nextMarks };
}

/** Press "hint, apply" until the grid is done or the engine gives up. */
function driveWithHints(puzzle: Puzzle): {
  outcome: 'solved' | 'stuck' | 'mistake' | 'looped';
  values: Grid;
  steps: number;
  techniques: TechniqueId[];
} {
  const size = puzzle.size;
  let values = empty(size);
  let marks = noMarks(size);
  const techniques: TechniqueId[] = [];
  // Every placement fills a cell; every elimination strictly shrinks the total
  // number of pencil digits on the board. Both are bounded, so this cap can
  // only be hit by a genuine cycle.
  const cap = size * size * (size + 2);

  for (let steps = 1; steps <= cap; steps++) {
    const result = findHint(puzzle, values, marks, {});
    if (result.kind !== 'hint') {
      return { outcome: result.kind === 'solved' ? 'solved' : result.kind, values, steps, techniques };
    }
    techniques.push(result.hint.technique);
    ({ values, marks } = applyHint(puzzle, values, marks, result.hint));
  }
  return { outcome: 'looped', values, steps: cap, techniques };
}

/* ------------------------------------------------------------------ */
/* Hand-built layouts                                                   */
/* ------------------------------------------------------------------ */

/**
 * `1-` pairs are the perfect filler: in any grid size every pair of adjacent
 * digits is legal, so they narrow nothing and leave exactly one deduction
 * standing wherever the interesting cage is.
 */

/** Row 1's last three cells are a `9+` cage, so only cell 0 can hold a 1. */
const HIDDEN_SINGLE = tiled(4, [
  [[1, 2, 3], '+', 9],
  [[0, 4], '-', 1],
  [[5, 6], '-', 1],
  [[7, 11], '-', 1],
  [[8, 12], '-', 1],
  [[9, 10], '-', 1],
  [[13, 14, 15], '+', 9],
]);

/**
 * Two hidden singles and nothing easier. Each `7+` pair excludes 1 from four
 * cells of its row without pinning its own digits, so no cage-combination hint
 * fires first — rows 1 and 3 are left with exactly one home for a 1.
 */
const HIDDEN_SINGLE_ONLY = tiled(5, [
  [[1, 2], '+', 7],
  [[3, 4], '+', 7],
  [[11, 12], '+', 7],
  [[13, 14], '+', 7],
  [[0, 5], '-', 1],
  [[6, 7], '-', 1],
  [[8, 9], '-', 1],
  [[10, 15], '-', 1],
  [[16, 17], '-', 1],
  [[18, 19], '-', 1],
  [[20, 21], '-', 1],
  [[22, 23, 24], '+', 9],
]);

/** One cage with a single arrangement, another with a single digit set. */
const PLACE_VS_ELIMINATE = tiled(4, [
  [[0, 1, 5], '*', 2],
  [[2, 3], '+', 7],
  [[4, 8], '-', 1],
  [[6, 7], '-', 1],
  [[9, 10], '-', 1],
  [[11, 15], '-', 1],
  [[12, 13, 14], '+', 9],
]);

/** A `7+` pair in row 1: two arrangements, one set of digits. */
const NARROWED_CAGE = tiled(4, [
  [[2, 3], '+', 7],
  [[0, 1], '-', 1],
  [[4, 5], '-', 1],
  [[6, 7], '-', 1],
  [[8, 9], '-', 1],
  [[10, 11], '-', 1],
  [[12, 13], '-', 1],
  [[14, 15], '-', 1],
]);

/** Column 1 covered bar one cell by a single `6+` cage. */
const INNIE_ONE_CAGE = tiled(4, [
  [[4, 8, 12], '+', 6],
  [[0, 1], '-', 1],
  [[2, 3], '-', 1],
  [[5, 6], '-', 1],
  [[7, 11], '-', 1],
  [[9, 10], '-', 1],
  [[13, 14, 15], '+', 9],
]);

/**
 * Column 1 of a 5x5 covered bar one cell by two additive cages, each with a
 * pinned sum but two possible digit pairs — so the innie is the *easiest*
 * available step, not merely an available one.
 */
const INNIE_TWO_CAGES = tiled(5, [
  [[0, 5], '+', 7],
  [[10, 15], '+', 6],
  [[20, 21], '-', 1],
  [[1, 2], '-', 1],
  [[3, 4], '-', 1],
  [[6, 7], '-', 1],
  [[8, 9], '-', 1],
  [[11, 12], '-', 1],
  [[13, 14], '-', 1],
  [[16, 17], '-', 1],
  [[18, 19], '-', 1],
  [[22, 23, 24], '+', 9],
]);

/* ------------------------------------------------------------------ */
/* Registry                                                             */
/* ------------------------------------------------------------------ */

describe('technique registry', () => {
  it('enables exactly the Tier 1 ladder from docs/HINTS.md §10', () => {
    expect(ENABLED_TECHNIQUES).toEqual([
      'freebie-cage',
      'last-cell-in-unit',
      'single-cage-combination',
      'naked-single',
      'hidden-single',
      'unit-sum-innie',
      'unit-sum-outie',
      'cage-locks-line',
    ]);
  });

  it('lists the enabled techniques in ascending rank order', () => {
    const ranks = ENABLED_TECHNIQUES.map((id) => TECHNIQUE_RANK[id]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranks).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('has a rank for every technique the spec names, including deferred ones', () => {
    expect(TECHNIQUE_RANK['unit-sum-bound']).toBe(90);
    expect(TECHNIQUE_RANK['line-locks-cage']).toBe(100);
    expect(TECHNIQUE_RANK['x-wing']).toBe(140);
  });

  it('has no detector wired up for a deferred technique', () => {
    expect(detectorFor('naked-set')).toBeUndefined();
    expect(detectorFor('unit-sum-bound')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Per-detector tests                                                   */
/* ------------------------------------------------------------------ */

describe('detector: freebie-cage', () => {
  it('reads the answer straight off a one-cell cage', () => {
    const hints = detect('freebie-cage', DOC_PUZZLE);
    expect(hints).toHaveLength(1);
    expect(hints[0].text).toBe('This cell has to be 1');
    expect(hints[0].secondary).toBe('Given cell');
    expect(hints[0].apply).toEqual({ kind: 'place', cells: [{ cell: 15, value: 1 }] });
    expect(hints[0].highlight).toMatchObject({ focus: [15], cages: [7], dimRest: true });
  });

  it('goes quiet once the cell is filled', () => {
    expect(detect('freebie-cage', DOC_PUZZLE, withValues(4, { 15: 1 }))).toEqual([]);
  });
});

describe('detector: last-cell-in-unit', () => {
  it('names the digit that is left, and the row that leaves it', () => {
    const values = withValues(4, { 12: 4, 13: 3, 14: 2 });
    const hints = detect('last-cell-in-unit', DOC_PUZZLE, values);
    const hint = hints.find((h) => h.highlight.focus[0] === 15);
    expect(hint?.text).toBe('Only 1 can go here in row 4');
    expect(hint?.secondary).toBe('Last cell in a row');
    expect(hint?.apply).toEqual({ kind: 'place', cells: [{ cell: 15, value: 1 }] });
    expect(hint?.highlight).toMatchObject({ focus: [15], support: [12, 13, 14], rows: [3], cols: [] });
  });

  it('says "column" when the unit is a column', () => {
    const values = withValues(4, { 0: 1, 4: 3, 8: 2 });
    const hint = detect('last-cell-in-unit', DOC_PUZZLE, values).find(
      (h) => h.highlight.focus[0] === 12,
    );
    expect(hint?.text).toBe('Only 4 can go here in column 1');
    expect(hint?.secondary).toBe('Last cell in a column');
    expect(hint?.highlight).toMatchObject({ rows: [], cols: [0] });
  });

  it('has nothing to say about a unit with two gaps', () => {
    const values = withValues(4, { 12: 4, 13: 3 });
    expect(detect('last-cell-in-unit', DOC_PUZZLE, values)).toEqual([]);
  });
});

describe('detector: single-cage-combination', () => {
  it('narrows a cage whose arrangements all use the same digits', () => {
    const hints = detect('single-cage-combination', NARROWED_CAGE);
    expect(hints).toHaveLength(1);
    expect(hints[0].text).toBe('1 and 2 cannot go in this cage');
    expect(hints[0].secondary).toBe('Cage combination');
    expect(hints[0].apply).toEqual({
      kind: 'eliminate',
      cells: [
        { cell: 2, digits: [1, 2] },
        { cell: 3, digits: [1, 2] },
      ],
    });
    expect(hints[0].highlight.strike).toEqual([
      { cell: 2, digits: [1, 2] },
      { cell: 3, digits: [1, 2] },
    ]);
  });

  it('places every cell when only one arrangement survives', () => {
    // Board order, repeats kept: the 2x cage genuinely holds a 1 twice, and
    // sorting or de-duplicating the list would misdescribe it.
    const hints = detect('single-cage-combination', SAMPLE_PUZZLE);
    const hint = hints.find((h) => h.highlight.cages[0] === 0);
    expect(hint?.text).toBe('This cage has to be 1, 2, and 1');
    expect(hint?.apply).toEqual({
      kind: 'place',
      cells: [
        { cell: 0, value: 1 },
        { cell: 1, value: 2 },
        { cell: 5, value: 1 },
      ],
    });
    expect(hint?.highlight).toMatchObject({ focus: [0, 1, 5], cages: [0] });
  });

  it('does not repeat itself once the player has written the marks down', () => {
    const marks = noMarks(4);
    marks[2] = [3, 4];
    marks[3] = [3, 4];
    expect(detect('single-cage-combination', NARROWED_CAGE, empty(4), marks)).toEqual([]);
  });

  it('still fires when the marks are merely narrower, not narrow enough', () => {
    const marks = noMarks(4);
    marks[2] = [2, 3, 4];
    marks[3] = [3, 4];
    const hints = detect('single-cage-combination', NARROWED_CAGE, empty(4), marks);
    // One cell struck, so "here" is precise enough to say.
    expect(hints[0].text).toBe('2 cannot go here');
    expect(hints[0].apply).toEqual({ kind: 'eliminate', cells: [{ cell: 2, digits: [2] }] });
    expect(hints[0].highlight).toMatchObject({ focus: [2], support: [3] });
  });
});

describe('detector: naked-single', () => {
  /*
   * The text is the same short sentence whatever pinned the cell — the reason
   * lives in the highlight now, so these three cases are distinguished by which
   * cells it points at rather than by a clause naming them.
   */
  it('points at the cage when the cage alone pins the cell', () => {
    const hint = detect('naked-single', SAMPLE_PUZZLE).find((h) => h.highlight.focus[0] === 0);
    expect(hint?.text).toBe('This cell has to be 1');
    expect(hint?.secondary).toBe('Naked single');
    expect(hint?.highlight).toMatchObject({ focus: [0], support: [1, 5], rows: [], cols: [], cages: [0] });
  });

  it('points at the peers when row and column elimination alone does it', () => {
    const values = withValues(4, { 1: 2, 2: 3, 3: 4 });
    const hint = detect('naked-single', DOC_PUZZLE, values).find((h) => h.highlight.focus[0] === 0);
    expect(hint?.text).toBe('This cell has to be 1');
    expect(hint?.highlight).toMatchObject({ focus: [0], support: [1, 2, 3], rows: [0], cols: [0] });
  });

  it('points at both when it takes both — the worked example from §4', () => {
    const hint = detect('naked-single', DOC_PUZZLE, withValues(4, { 4: 3 })).find(
      (h) => h.highlight.focus[0] === 0,
    );
    expect(hint?.text).toBe('This cell has to be 1');
    expect(hint?.apply).toEqual({ kind: 'place', cells: [{ cell: 0, value: 1 }] });
    expect(hint?.highlight).toMatchObject({ focus: [0], rows: [0], cols: [0], cages: [0] });
  });

  it('says nothing about a cell that still has two options', () => {
    expect(detect('naked-single', NARROWED_CAGE)).toEqual([]);
  });
});

describe('detector: hidden-single', () => {
  it('finds the only home a digit has left in a row', () => {
    const hint = detect('hidden-single', HIDDEN_SINGLE).find((h) => h.highlight.focus[0] === 0);
    expect(hint?.text).toBe('Only 1 can go here in row 1');
    expect(hint?.secondary).toBe('Hidden single');
    expect(hint?.apply).toEqual({ kind: 'place', cells: [{ cell: 0, value: 1 }] });
    expect(hint?.highlight).toMatchObject({ focus: [0], support: [1, 2, 3], rows: [0], cols: [] });
  });

  it('leaves cells that are already down to one digit to the naked-single rank', () => {
    // Every cell of SAMPLE_PUZZLE's 2x cage is pinned, so nothing there is
    // "hidden" — it is plainly visible, and rank 40 phrases it better.
    for (const hint of detect('hidden-single', SAMPLE_PUZZLE)) {
      expect([0, 1, 5]).not.toContain(hint.highlight.focus[0]);
    }
  });
});

describe('detector: unit-sum-innie', () => {
  it('subtracts one covering cage from the row total', () => {
    const hints = detect('unit-sum-innie', INNIE_ONE_CAGE);
    const hint = hints.find((h) => h.highlight.focus[0] === 0);
    expect(hint?.text).toBe('This cell has to be 4');
    expect(hint?.secondary).toBe('Column total (innie)');
    expect(hint?.apply).toEqual({ kind: 'place', cells: [{ cell: 0, value: 4 }] });
    expect(hint?.highlight).toMatchObject({
      focus: [0],
      support: [4, 8, 12],
      rows: [],
      cols: [0],
      cages: [0],
    });
  });

  it('subtracts several covering cages at once', () => {
    const hints = detect('unit-sum-innie', INNIE_TWO_CAGES);
    expect(hints).toHaveLength(1);
    expect(hints[0].text).toBe('This cell has to be 2');
    expect(hints[0].apply).toEqual({ kind: 'place', cells: [{ cell: 20, value: 2 }] });
    expect(hints[0].highlight).toMatchObject({ support: [0, 5, 10, 15], cages: [0, 1] });
  });
});

describe('detector: unit-sum-outie', () => {
  it('reproduces the worked example from docs/HINTS.md §4', () => {
    const hint = detect('unit-sum-outie', DOC_PUZZLE).find((h) => h.highlight.focus[0] === 14);
    expect(hint?.text).toBe('This cell has to be 2');
    expect(hint?.secondary).toBe('Column total (outie)');
    expect(hint?.apply).toEqual({ kind: 'place', cells: [{ cell: 14, value: 2 }] });
    expect(hint?.highlight).toMatchObject({
      focus: [14],
      support: [1, 5, 9, 13],
      cols: [1],
      cages: [1, 6],
    });
  });
});

describe('detector: cage-locks-line', () => {
  it('reproduces the worked example from docs/HINTS.md §4', () => {
    const hints = detect('cage-locks-line', NARROWED_CAGE);
    expect(hints).toHaveLength(1);
    expect(hints[0].text).toBe('3 and 4 cannot go anywhere else in row 1');
    expect(hints[0].secondary).toBe('Cage confinement');
    expect(hints[0].apply).toEqual({
      kind: 'eliminate',
      cells: [
        { cell: 0, digits: [3, 4] },
        { cell: 1, digits: [3, 4] },
      ],
    });
    expect(hints[0].highlight).toMatchObject({ focus: [0, 1], support: [2, 3], rows: [0], cages: [0] });
  });

  it('drops the conjunction when only one digit is locked in', () => {
    // Cage H is the single cell 15, so it claims a 1 for row 4 and column 4.
    const hint = detect('cage-locks-line', DOC_PUZZLE).find((h) => h.highlight.cages[0] === 7);
    expect(hint?.text).toMatch(/^\d cannot go anywhere else in (row|column) \d$/);
  });

  it('says "here" when the strike lands on a single cell', () => {
    const marks = noMarks(4);
    marks[0] = [1, 2];
    marks[1] = [1, 2, 3];
    const hints = detect('cage-locks-line', NARROWED_CAGE, empty(4), marks);
    expect(hints).toHaveLength(1);
    expect(hints[0].text).toBe('3 cannot go here');
    expect(hints[0].apply).toEqual({ kind: 'eliminate', cells: [{ cell: 1, digits: [3] }] });
  });

  it('goes quiet once the player has crossed those digits off', () => {
    const marks = noMarks(4);
    marks[0] = [1, 2];
    marks[1] = [1, 2];
    expect(detect('cage-locks-line', NARROWED_CAGE, empty(4), marks)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* findHint: the ladder                                                 */
/* ------------------------------------------------------------------ */

describe('findHint: ladder ordering', () => {
  it('opens with the freebie cage on an untouched board', () => {
    const result = findHint(DOC_PUZZLE, empty(4), noMarks(4));
    expect(result.kind).toBe('hint');
    if (result.kind !== 'hint') return;
    expect(result.hint.technique).toBe('freebie-cage');
  });

  it('prefers the friendlier phrasing when two techniques reach the same cell', () => {
    // Cell 0 of NARROWED_CAGE loses 3 and 4 to both `cage-locks-line` (rank 80)
    // and, once the marks are down, nothing else. The cage-combination hint at
    // rank 30 speaks first.
    const result = findHint(NARROWED_CAGE, empty(4), noMarks(4));
    expect(result.kind).toBe('hint');
    if (result.kind !== 'hint') return;
    expect(result.hint.technique).toBe('single-cage-combination');
  });

  it('honours maxRank', () => {
    const result = findHint(NARROWED_CAGE, empty(4), noMarks(4), { maxRank: 20 });
    expect(result.kind).toBe('stuck');
  });

  it('reaches the unit-sum ranks when nothing easier applies', () => {
    const result = findHint(INNIE_TWO_CAGES, empty(5), noMarks(5));
    expect(result.kind).toBe('hint');
    if (result.kind !== 'hint') return;
    expect(result.hint.technique).toBe('unit-sum-innie');
    expect(result.hint.apply).toEqual({ kind: 'place', cells: [{ cell: 20, value: 2 }] });
  });

  it('stops at hidden singles when the cages give nothing away', () => {
    const result = findHint(HIDDEN_SINGLE_ONLY, empty(5), noMarks(5), { near: null });
    expect(result.kind).toBe('hint');
    if (result.kind !== 'hint') return;
    expect(result.hint.technique).toBe('hidden-single');
  });
});

describe('findHint: selection among equals (§6.2)', () => {
  it('prefers a placement to an elimination', () => {
    // Rank 30 offers both here: the 2x cage has one arrangement, the 7+ cage
    // one digit set. Writing digits beats crossing them off.
    const result = findHint(PLACE_VS_ELIMINATE, empty(4), noMarks(4), { near: null });
    expect(result.kind).toBe('hint');
    if (result.kind !== 'hint') return;
    expect(result.hint.technique).toBe('single-cage-combination');
    expect(result.hint.apply.kind).toBe('place');
  });

  it('leans toward the cell the player is looking at', () => {
    // Two hidden singles are available: cell 0 (row 1) and cell 10 (row 3).
    const near0 = findHint(HIDDEN_SINGLE_ONLY, empty(5), noMarks(5), { near: 1 });
    const near10 = findHint(HIDDEN_SINGLE_ONLY, empty(5), noMarks(5), { near: 20 });
    expect(near0.kind === 'hint' && near0.hint.highlight.focus).toEqual([0]);
    expect(near10.kind === 'hint' && near10.hint.highlight.focus).toEqual([10]);
  });

  it('is deterministic when no cell is selected', () => {
    const a = findHint(HIDDEN_SINGLE_ONLY, empty(5), noMarks(5), { near: null });
    const b = findHint(HIDDEN_SINGLE_ONLY, empty(5), noMarks(5), { near: null });
    expect(a).toEqual(b);
    expect(a.kind === 'hint' && a.hint.highlight.focus).toEqual([0]);
  });
});

describe('findHint: the recent ring buffer (§6.3)', () => {
  it('builds a signature from technique, focus and digits', () => {
    expect(hintSignature('naked-single', [5], [3])).toBe('naked-single|5|3');
    expect(hintSignature('cage-locks-line', [1, 0], [4, 3])).toBe('cage-locks-line|0,1|3,4');
  });

  it('skips a hint the player has just seen', () => {
    const first = findHint(HIDDEN_SINGLE_ONLY, empty(5), noMarks(5), { near: null });
    expect(first.kind).toBe('hint');
    if (first.kind !== 'hint') return;
    const second = findHint(HIDDEN_SINGLE_ONLY, empty(5), noMarks(5), {
      near: null,
      recent: [first.hint.signature],
    });
    expect(second.kind).toBe('hint');
    if (second.kind !== 'hint') return;
    expect(second.hint.signature).not.toBe(first.hint.signature);
  });

  it('never reports "stuck" merely because everything was recent', () => {
    // NARROWED_CAGE has exactly one hint at or below rank 30, so with it in
    // `recent` the first pass finds nothing at all. Step 5 must retry.
    const opts = { near: null, maxRank: 30 };
    const first = findHint(NARROWED_CAGE, empty(4), noMarks(4), opts);
    expect(first.kind).toBe('hint');
    if (first.kind !== 'hint') return;
    const again = findHint(NARROWED_CAGE, empty(4), noMarks(4), {
      ...opts,
      recent: [first.hint.signature],
    });
    expect(again).toEqual(first);
  });
});

/* ------------------------------------------------------------------ */
/* findHint: degenerate cases (§8)                                      */
/* ------------------------------------------------------------------ */

describe('findHint: degenerate cases', () => {
  it('congratulates a finished grid', () => {
    const result = findHint(DOC_PUZZLE, [...DOC_PUZZLE.solution], noMarks(4));
    expect(result).toEqual({
      kind: 'solved',
      text: 'The grid is complete',
      secondary: 'Solved',
    });
  });

  it('points at a wrong digit before trying to deduce anything', () => {
    const values = withValues(4, { 5: 1 }); // solution says 4
    const result = findHint(DOC_PUZZLE, values, noMarks(4));
    expect(result).toEqual({
      kind: 'mistake',
      cells: [5],
      text: "This cell doesn't fit",
      secondary: 'Check this cell',
    });
  });

  it('reports every wrong cell, and counts them', () => {
    const values = withValues(4, { 5: 1, 9: 4 });
    const result = findHint(DOC_PUZZLE, values, noMarks(4));
    expect(result.kind).toBe('mistake');
    if (result.kind !== 'mistake') return;
    expect(result.cells).toEqual([5, 9]);
    expect(result.text).toBe("These 2 cells don't fit");
  });

  it('refuses to point when asked not to', () => {
    const result = findHint(DOC_PUZZLE, withValues(4, { 5: 1 }), noMarks(4), {
      revealMistakeCell: false,
    });
    expect(result).toEqual({
      kind: 'mistake',
      cells: [5],
      text: "Something on the board doesn't fit",
      secondary: 'Check your work',
    });
  });

  it('admits when the ladder runs out', () => {
    const result = findHint(NARROWED_CAGE, empty(4), noMarks(4), { maxRank: 20 });
    expect(result).toEqual({
      kind: 'stuck',
      text: "I can't find a next step here",
      secondary: 'No forced step',
    });
  });
});

describe('revealHint', () => {
  it('picks the most constrained empty cell and reads off the solution', () => {
    const hint = revealHint(DOC_PUZZLE, empty(4));
    expect(hint.technique).toBe('reveal');
    expect(hint.secondary).toBe('Revealed');
    expect(hint.apply.kind).toBe('place');
    if (hint.apply.kind !== 'place') return;
    const { cell, value } = hint.apply.cells[0];
    expect(value).toBe(DOC_PUZZLE.solution[cell]);
    expect(hint.text).toBe(`This cell has to be ${value}`);
  });

  it('breaks ties toward the cell the player has selected', () => {
    const near = revealHint(SAMPLE_PUZZLE, empty(4), { near: 15 });
    const far = revealHint(SAMPLE_PUZZLE, empty(4), { near: 0 });
    expect(near.highlight.focus[0]).not.toBe(far.highlight.focus[0]);
  });

  it('always names a correct digit, wherever it lands', () => {
    for (const size of [4, 5]) {
      const puzzle = generatePuzzle({ size, difficulty: 'hard', seed: `reveal-${size}` });
      const values = empty(size);
      for (let i = 0; i < size; i++) values[i] = puzzle.solution[i];
      const hint = revealHint(puzzle, values);
      if (hint.apply.kind !== 'place') throw new Error('reveal must place');
      const { cell, value } = hint.apply.cells[0];
      expect(values[cell]).toBeNull();
      expect(value).toBe(puzzle.solution[cell]);
    }
  });
});

/* ------------------------------------------------------------------ */
/* findNextNumber                                                       */
/* ------------------------------------------------------------------ */

describe('findNextNumber', () => {
  it('returns the placement straight away when the ladder opens with one', () => {
    expect(findNextNumber(DOC_PUZZLE, empty(4), noMarks(4))).toEqual({ cell: 15, value: 1 });
  });

  it('runs past the eliminations the ladder would have offered first', () => {
    // The 9+ cages narrow to {2,3,4} before anything can be placed, so the
    // hint button would say "1 cannot go in this cage" twice over. Asking for
    // a number has to consume both and keep going.
    const opening = findHint(HIDDEN_SINGLE, empty(4), noMarks(4), { near: null });
    expect(opening.kind === 'hint' && opening.hint.apply.kind).toBe('eliminate');

    expect(findNextNumber(HIDDEN_SINGLE, empty(4), noMarks(4), { near: null })).toEqual({
      cell: 0,
      value: 1,
    });
  });

  it('leaves the caller marks untouched', () => {
    const marks = noMarks(4);
    const before = JSON.stringify(marks);
    findNextNumber(HIDDEN_SINGLE, empty(4), marks, { near: null });
    expect(JSON.stringify(marks)).toBe(before);
  });

  it('agrees with the solution wherever it lands', () => {
    for (const size of [4, 5]) {
      const puzzle = generatePuzzle({ size, difficulty: 'medium', seed: `next-${size}` });
      const values = empty(size);
      for (let cell = 0; cell < size * size; cell += 4) values[cell] = puzzle.solution[cell];
      const next = findNextNumber(puzzle, values, noMarks(size));
      if (next === null) continue;
      expect(values[next.cell]).toBeNull();
      expect(next.value).toBe(puzzle.solution[next.cell]);
    }
  });

  it('has nothing to offer on a finished grid', () => {
    expect(findNextNumber(DOC_PUZZLE, [...DOC_PUZZLE.solution], noMarks(4))).toBeNull();
  });

  it('refuses to guess past a wrong digit', () => {
    const values = withValues(4, { 5: 1 }); // solution says 4
    expect(findNextNumber(DOC_PUZZLE, values, noMarks(4))).toBeNull();
  });

  it('gives up rather than spin when no placement is reachable', () => {
    // NARROWED_CAGE has eliminations to spare and no placement behind them:
    // nothing the marks record can change what `book` already knows.
    expect(findNextNumber(NARROWED_CAGE, empty(4), noMarks(4), { near: null })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* checkCorrectness                                                     */
/* ------------------------------------------------------------------ */

describe('checkCorrectness', () => {
  it('says nothing about an empty grid', () => {
    expect(checkCorrectness(DOC_PUZZLE, empty(4))).toEqual({ correct: [], incorrect: [] });
  });

  it('passes a finished grid entirely', () => {
    const report = checkCorrectness(DOC_PUZZLE, [...DOC_PUZZLE.solution]);
    expect(report.correct).toEqual([...Array(16).keys()]);
    expect(report.incorrect).toEqual([]);
  });

  it('splits filled cells by whether they match the solution', () => {
    const values = withValues(4, { 0: DOC_PUZZLE.solution[0], 5: 1, 9: 4 });
    expect(checkCorrectness(DOC_PUZZLE, values)).toEqual({ correct: [0], incorrect: [5, 9] });
  });

  it('sees a wrong digit that breaks no visible rule', () => {
    // Cell 5 alone conflicts with nothing on an otherwise empty board, which is
    // exactly the case `errors.ts` cannot and should not report.
    expect(checkCorrectness(DOC_PUZZLE, withValues(4, { 5: 1 })).incorrect).toEqual([5]);
  });
});

/* ------------------------------------------------------------------ */
/* The book / visible split (§2)                                        */
/* ------------------------------------------------------------------ */

describe('marks influence novelty, never conclusions', () => {
  it('reaches the same placement however wrong the pencil marks are', () => {
    // Marks that exclude the true digit everywhere. A hint engine that reasoned
    // from marks would either fall silent or say something false.
    const puzzle = generatePuzzle({ size: 5, difficulty: 'medium', seed: 'marks-lie' });
    const values = empty(5);
    const honest = noMarks(5);
    const lying = noMarks(5).map((_, cell) => [(puzzle.solution[cell] % 5) + 1]);

    const a = findHint(puzzle, values, honest, { near: null });
    const b = findHint(puzzle, values, lying, { near: null });
    expect(a.kind).toBe('hint');
    expect(b.kind).toBe('hint');
    if (a.kind !== 'hint' || b.kind !== 'hint') return;
    for (const hint of [a.hint, b.hint]) {
      if (hint.apply.kind !== 'place') continue;
      for (const { cell, value } of hint.apply.cells) {
        expect(value).toBe(puzzle.solution[cell]);
      }
    }
  });

  it('never crosses off the digit that actually belongs in a cell', () => {
    const puzzle = generatePuzzle({ size: 5, difficulty: 'hard', seed: 'no-false-cuts' });
    const values = empty(5);
    for (let cell = 0; cell < 25; cell += 3) values[cell] = puzzle.solution[cell];
    const result = findHint(puzzle, values, noMarks(5));
    if (result.kind !== 'hint' || result.hint.apply.kind !== 'eliminate') return;
    for (const { cell, digits } of result.hint.apply.cells) {
      expect(digits).not.toContain(puzzle.solution[cell]);
    }
  });

  it('makes elimination hints self-limiting', () => {
    let values = empty(4);
    let marks = noMarks(4);
    const first = findHint(NARROWED_CAGE, values, marks, { near: null });
    expect(first.kind).toBe('hint');
    if (first.kind !== 'hint') return;
    expect(first.hint.apply.kind).toBe('eliminate');

    ({ values, marks } = applyHint(NARROWED_CAGE, values, marks, first.hint));
    expect(marks[2]).toEqual([3, 4]);

    const second = findHint(NARROWED_CAGE, values, marks, { near: null });
    if (second.kind === 'hint') expect(second.hint.signature).not.toBe(first.hint.signature);
  });
});

/* ------------------------------------------------------------------ */
/* Property tests                                                       */
/* ------------------------------------------------------------------ */

const SIZES = [4, 5, 6, 7] as const;

/** Deterministic partial fills: reveal a seeded subset of the true solution. */
function partialFills(puzzle: Puzzle, seed: string): Grid[] {
  const cellCount = puzzle.size * puzzle.size;
  const order = makeRng(seed).shuffle([...Array(cellCount).keys()]);
  const out: Grid[] = [];
  for (const fraction of [0, 0.2, 0.45, 0.7, 0.9]) {
    const grid = empty(puzzle.size);
    for (let i = 0; i < Math.floor(cellCount * fraction); i++) {
      grid[order[i]] = puzzle.solution[order[i]];
    }
    out.push(grid);
  }
  return out;
}

describe('soundness: a hint is never wrong', () => {
  it.each(SIZES)('places only true digits on size-%i grids, every difficulty', (size) => {
    let placements = 0;
    let eliminations = 0;
    for (const difficulty of DIFFICULTIES) {
      for (let s = 0; s < 8; s++) {
        const seed = `sound-${size}-${difficulty}-${s}`;
        const puzzle = generatePuzzle({ size, difficulty, seed });
        for (const values of partialFills(puzzle, seed)) {
          for (const near of [null, 0]) {
            const result = findHint(puzzle, values, noMarks(size), { near });
            expect(result.kind).not.toBe('mistake');
            // Pure: the same board must always produce the same advice.
            expect(findHint(puzzle, values, noMarks(size), { near })).toEqual(result);
            if (result.kind !== 'hint') continue;
            expect(result.hint.apply.cells.length).toBeGreaterThan(0);
            // The invariant the whole engine rests on. Note that nothing in the
            // derivation may consult `solution`; only this assertion does.
            if (result.hint.apply.kind === 'place') {
              for (const { cell, value } of result.hint.apply.cells) {
                expect(values[cell]).toBeNull();
                expect(value).toBe(puzzle.solution[cell]);
                placements++;
              }
            } else {
              for (const { cell, digits } of result.hint.apply.cells) {
                expect(digits).not.toContain(puzzle.solution[cell]);
                eliminations++;
              }
            }
          }
        }
      }
    }
    expect(placements + eliminations).toBeGreaterThan(50);
  });
});

describe('progress: applying hints drives the grid to the solution', () => {
  it.each(SIZES)('terminates cleanly on every size-%i puzzle it is given', (size) => {
    for (const difficulty of DIFFICULTIES) {
      for (let s = 0; s < 4; s++) {
        const puzzle = generatePuzzle({ size, difficulty, seed: `drive-${size}-${difficulty}-${s}` });
        const run = driveWithHints(puzzle);
        // Never a cycle, and never an accusation against a grid the engine
        // filled in itself.
        expect(run.outcome).not.toBe('looped');
        expect(run.outcome).not.toBe('mistake');
        if (run.outcome === 'solved') expect(run.values).toEqual(puzzle.solution);
        else {
          // A `stuck` grid must still be correct as far as it goes.
          run.values.forEach((value, cell) => {
            if (value !== null) expect(value).toBe(puzzle.solution[cell]);
          });
        }
      }
    }
  });

  it('solves the two 4x4 fixtures outright', () => {
    for (const puzzle of [DOC_PUZZLE, SAMPLE_PUZZLE]) {
      const run = driveWithHints(puzzle);
      expect(run.outcome).toBe('solved');
      expect(run.values).toEqual(puzzle.solution);
    }
  });

  it('gets every easy puzzle all the way home, at every size', () => {
    // The Tier 1 ladder is meant to cover easy play completely. Anything less
    // and the scope cut in §10 was the wrong one.
    for (const size of [3, 4, 5, 6, 7]) {
      for (let s = 0; s < 6; s++) {
        const puzzle = generatePuzzle({ size, difficulty: 'easy', seed: `easy-${size}-${s}` });
        expect(driveWithHints(puzzle).outcome).toBe('solved');
      }
    }
  });

  it('finishes the large majority of medium puzzles', () => {
    const outcomes: Record<string, number> = { solved: 0, stuck: 0 };
    for (const size of SIZES) {
      for (const difficulty of ['easy', 'medium'] as Difficulty[]) {
        for (let s = 0; s < 6; s++) {
          const puzzle = generatePuzzle({
            size,
            difficulty,
            seed: `rate-${size}-${difficulty}-${s}`,
          });
          outcomes[driveWithHints(puzzle).outcome] += 1;
        }
      }
    }
    // Not a tight bound — `stuck` is honest, not a bug (§8.3). It is here so a
    // regression that made the ladder stop working would be visible.
    expect(outcomes.solved).toBeGreaterThan(outcomes.stuck * 4);
  });
});
