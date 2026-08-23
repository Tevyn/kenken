/**
 * The hint engine — see `docs/HINTS.md`.
 *
 * `findHint` finds the *easiest* deduction available from the player's grid,
 * explains it in plain English, says what to highlight, and carries the edit
 * that applies it. It is pure: same inputs give an identical result, including
 * the choice among equally-ranked candidates.
 *
 * Two rules govern everything here:
 *
 *  - **Soundness.** Conclusions come only from the puzzle and the player's
 *    filled `values`, via the rules-(A)+(B) fixpoint in `candidates.ts`. Pencil
 *    marks are never an input to a deduction; a player's marks may be wrong,
 *    and reasoning from them would produce a hint that is simply false.
 *  - **Novelty.** Pencil marks *are* used to decide whether a sound conclusion
 *    is worth showing. A placement is offered only for an empty cell; an
 *    elimination only when it removes a digit the player can currently see.
 *    This is what stops candidate-narrowing hints repeating forever: apply one
 *    and the marks it writes make it stop firing.
 *
 * `puzzle.solution` is read in exactly three places, none of them deductive:
 * mistake detection (§8.2), the `reveal` escape hatch (§8.3), and
 * `checkCorrectness`.
 */

import {
  bit,
  buildCandidateState,
  candidateSets,
  digitsToMask,
  isRowKey,
  maskToDigits,
  peersOf,
  popcount,
  soleDigit,
  unitLine,
  visibleMasks,
  type CandidateState,
  type MarkSets,
} from './candidates';
import { enumerateCageCombos } from './solver';
import { findInnies, findOuties } from './unitSums';
import { colOf, rowOf, type CellIndex, type Grid, type Puzzle } from './types';

export type { MarkSets } from './candidates';
export { cageSumSet, candidateSets, visibleSets } from './candidates';

/* ------------------------------------------------------------------ */
/* Public types                                                         */
/* ------------------------------------------------------------------ */

export type TechniqueId =
  | 'freebie-cage'
  | 'last-cell-in-unit'
  | 'single-cage-combination'
  | 'naked-single'
  | 'hidden-single'
  | 'unit-sum-innie'
  | 'unit-sum-outie'
  | 'cage-locks-line'
  | 'unit-sum-bound'
  | 'line-locks-cage'
  | 'naked-set'
  | 'hidden-set'
  | 'unit-parity'
  | 'x-wing'
  | 'reveal';

/** Rank of each technique, ascending = easier. See `docs/HINTS.md` §3. */
export const TECHNIQUE_RANK: Record<TechniqueId, number> = {
  'freebie-cage': 10,
  'last-cell-in-unit': 20,
  'single-cage-combination': 30,
  'naked-single': 40,
  'hidden-single': 50,
  'unit-sum-innie': 60,
  'unit-sum-outie': 70,
  'cage-locks-line': 80,
  'unit-sum-bound': 90,
  'line-locks-cage': 100,
  'naked-set': 110,
  'hidden-set': 120,
  'unit-parity': 130,
  'x-wing': 140,
  reveal: Number.POSITIVE_INFINITY,
};

export interface HintHighlight {
  /** Cells carrying the conclusion. Strongest emphasis. */
  focus: CellIndex[];
  /** Cells supplying the reason. Secondary emphasis. */
  support: CellIndex[];
  /** 0-based rows to tint as a band. */
  rows: number[];
  /** 0-based columns to tint as a band. */
  cols: number[];
  /** `Cage.id`s to outline in the accent colour. */
  cages: number[];
  /** Dim every cell not named by focus/support/rows/cols/cages. */
  dimRest: boolean;
  /** Per-cell pencil digits to render struck through. */
  strike: Array<{ cell: CellIndex; digits: number[] }>;
}

export type HintApply =
  | { kind: 'place'; cells: Array<{ cell: CellIndex; value: number }> }
  | { kind: 'eliminate'; cells: Array<{ cell: CellIndex; digits: number[] }> };

export interface Hint {
  technique: TechniqueId;
  rank: number;
  /** Player-facing, jargon-free. */
  text: string;
  /** The technique's proper name, e.g. "Hidden single". */
  secondary: string;
  highlight: HintHighlight;
  apply: HintApply;
  /** Stable identity for the `recent` ring buffer. See §6.3. */
  signature: string;
}

export type HintResult =
  | { kind: 'hint'; hint: Hint }
  | { kind: 'mistake'; cells: CellIndex[]; text: string; secondary: string }
  | { kind: 'stuck'; text: string; secondary: string }
  | { kind: 'solved'; text: string; secondary: string };

export interface HintOptions {
  /** Bias selection toward this cell; normally `state.selected`. */
  near?: CellIndex | null;
  /** Signatures to skip. Ring buffer of the last 3 applied hints. */
  recent?: readonly string[];
  /** Never offer a technique ranked above this. Default: no cap. */
  maxRank?: number;
  /** Name the offending cell on a mistake. Default true. */
  revealMistakeCell?: boolean;
}

/* ------------------------------------------------------------------ */
/* Detector contract (§9.1)                                             */
/* ------------------------------------------------------------------ */

export interface DetectContext {
  puzzle: Puzzle;
  size: number;
  values: Grid;
  /** Bitmask per cell, rules (A)+(B) fixpoint. Never derived from marks. */
  book: Int32Array;
  /** Bitmask per cell, per §2. Used only for the novelty test. */
  visible: Int32Array;
  /** Surviving combinations per cage, post-fixpoint. */
  combos: number[][][];
  /** cell -> index into `puzzle.cages`. */
  cageOfCell: Int32Array;
  /** unit key -> member cells; rows are `0..size-1`, cols are `size..2*size-1`. */
  units: number[][];
  /**
   * The state the four views above are drawn from. Detectors that need a
   * cage's per-unit overlap or its possible sums read it here rather than
   * recomputing; nothing may mutate it.
   */
  state: CandidateState;
}

export type Detector = (ctx: DetectContext) => Hint[];

/** Build a detector context. Exported so each detector can be tested alone. */
export function detectContext(puzzle: Puzzle, values: Grid, marks: MarkSets): DetectContext {
  const state = buildCandidateState(puzzle, values);
  return {
    puzzle,
    size: state.size,
    values,
    book: state.cands,
    visible: visibleMasks(puzzle, values, marks),
    combos: state.combos,
    cageOfCell: state.cageOfCell,
    units: state.units,
    state,
  };
}

/* ------------------------------------------------------------------ */
/* Wording helpers                                                      */
/* ------------------------------------------------------------------ */

/*
 * `text` is one short clause and nothing more: no technique name, no "because"
 * tail, and no per-cell coordinates — the highlight is what says where, and
 * repeating it in words only competes with it. A row or column number appears
 * only in `Only 3 can go here in column 2`, where the line is not the location
 * but the whole reason. `secondary` still carries the technique's proper name
 * for anyone who wants the vocabulary.
 */

/** `"row 2, column 3"`, 1-based. Not used in hint text; see the note above. */
export function cellRef(cell: CellIndex, size: number): string {
  return `row ${rowOf(cell, size) + 1}, column ${colOf(cell, size) + 1}`;
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const unitKind = (key: number, size: number): 'row' | 'column' =>
  isRowKey(key, size) ? 'row' : 'column';

/** `"column 3"`, 1-based. */
function unitName(key: number, size: number): string {
  return `${unitKind(key, size)} ${unitLine(key, size) + 1}`;
}

/** `"1, 2 and 3"` / `"1 or 2"` / `"1"`. */
function joinList(parts: readonly string[], conjunction: 'and' | 'or'): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} ${conjunction} ${parts[parts.length - 1]}`;
}

const digitList = (digits: readonly number[], conjunction: 'and' | 'or' = 'and'): string =>
  joinList(digits.map(String), conjunction);

/** `"This cell has to be 2"` — the plain placement. */
const placedHere = (digit: number): string => `This cell has to be ${digit}`;

/** `"3 and 5 cannot go here"` — the plain elimination. */
const ruledOutHere = (digits: readonly number[]): string => `${digitList(digits)} cannot go here`;

/* ------------------------------------------------------------------ */
/* Hint construction                                                    */
/* ------------------------------------------------------------------ */

const emptyHighlight = (): HintHighlight => ({
  focus: [],
  support: [],
  rows: [],
  cols: [],
  cages: [],
  dimRest: true,
  strike: [],
});

/** Row/column band for a unit key, as the `rows`/`cols` halves of a highlight. */
function unitBand(key: number, size: number): Pick<HintHighlight, 'rows' | 'cols'> {
  return isRowKey(key, size)
    ? { rows: [unitLine(key, size)], cols: [] }
    : { rows: [], cols: [unitLine(key, size)] };
}

const ascending = (values: Iterable<number>): number[] =>
  [...new Set(values)].sort((a, b) => a - b);

/** Every digit an elimination removes anywhere, ascending. */
const removedDigits = (cells: ReadonlyArray<{ digits: number[] }>): number[] =>
  ascending(cells.flatMap((e) => e.digits));

/** §6.3. `digits` is the placed value(s) or the eliminated digits, sorted. */
export function hintSignature(
  technique: TechniqueId,
  focus: readonly CellIndex[],
  digits: readonly number[],
): string {
  return `${technique}|${ascending(focus).join(',')}|${ascending(digits).join(',')}`;
}

function makeHint(
  technique: TechniqueId,
  text: string,
  secondary: string,
  highlight: HintHighlight,
  apply: HintApply,
): Hint {
  const digits =
    apply.kind === 'place'
      ? apply.cells.map((e) => e.value)
      : apply.cells.flatMap((e) => e.digits);
  return {
    technique,
    rank: TECHNIQUE_RANK[technique],
    text,
    secondary,
    highlight,
    apply,
    signature: hintSignature(technique, highlight.focus, digits),
  };
}

/* ------------------------------------------------------------------ */
/* Detectors — Tier 1                                                   */
/* ------------------------------------------------------------------ */

/** rank 10. A one-cell cage is its own answer. */
const detectFreebieCage: Detector = (ctx) => {
  const out: Hint[] = [];
  for (const info of ctx.state.cages) {
    if (info.cells.length !== 1) continue;
    const cell = info.cells[0];
    if (ctx.values[cell] !== null && ctx.values[cell] !== undefined) continue;
    const digit = info.cage.target;
    if (digit < 1 || digit > ctx.size) continue;
    if ((ctx.book[cell] & bit(digit)) === 0) continue;

    const highlight = emptyHighlight();
    highlight.focus = [cell];
    highlight.cages = [info.cage.id];
    out.push(
      makeHint(
        'freebie-cage',
        placedHere(digit),
        'Given cell',
        highlight,
        { kind: 'place', cells: [{ cell, value: digit }] },
      ),
    );
  }
  return out;
};

/** rank 20. A row or column with one gap left. */
const detectLastCellInUnit: Detector = (ctx) => {
  const out: Hint[] = [];
  for (let key = 0; key < ctx.units.length; key++) {
    const members = ctx.units[key];
    const empties = members.filter((c) => ctx.values[c] === null || ctx.values[c] === undefined);
    if (empties.length !== 1) continue;
    const cell = empties[0];

    const others = members.filter((c) => c !== cell);
    const present = new Set(others.map((c) => ctx.values[c] as number));
    const missing: number[] = [];
    for (let v = 1; v <= ctx.size; v++) if (!present.has(v)) missing.push(v);
    // Two missing digits means the player has repeated one; that is a mistake,
    // not a hint, and `findHint` bails on it long before this runs.
    if (missing.length !== 1) continue;
    const digit = missing[0];
    if ((ctx.book[cell] & bit(digit)) === 0) continue;

    const highlight = emptyHighlight();
    highlight.focus = [cell];
    highlight.support = others;
    Object.assign(highlight, unitBand(key, ctx.size));

    const kind = unitKind(key, ctx.size);
    out.push(
      makeHint(
        'last-cell-in-unit',
        `Only ${digit} can go here in ${unitName(key, ctx.size)}`,
        `Last cell in a ${kind}`,
        highlight,
        { kind: 'place', cells: [{ cell, value: digit }] },
      ),
    );
  }
  return out;
};

/**
 * rank 30. Every surviving arrangement of the cage uses the same digits.
 *
 * Two variants: one surviving arrangement places every cell, several
 * arrangements over one multiset rule out every digit outside it.
 */
const detectSingleCageCombination: Detector = (ctx) => {
  const out: Hint[] = [];
  for (const info of ctx.state.cages) {
    // A one-cell cage is `freebie-cage`, which says it far more nicely.
    if (info.cells.length < 2) continue;
    const list = ctx.combos[info.index];
    if (list.length === 0) continue;

    const multisets = new Set(list.map((combo) => [...combo].sort((a, b) => a - b).join(',')));
    if (multisets.size !== 1) continue;
    const multiset = [...list[0]].sort((a, b) => a - b);

    if (list.length === 1) {
      const combo = list[0];
      const places = info.cells
        .map((cell, k) => ({ cell, value: combo[k] }))
        .filter((e) => ctx.values[e.cell] === null || ctx.values[e.cell] === undefined);
      if (places.length === 0) continue;

      const highlight = emptyHighlight();
      highlight.focus = info.cells.slice();
      highlight.cages = [info.cage.id];
      // Board order, and neither sorted nor de-duplicated: a bent cage can
      // legally repeat a digit, so the list has to read the way the cage does.
      const inOrder = places.slice().sort((a, b) => a.cell - b.cell);
      out.push(
        makeHint(
          'single-cage-combination',
          `This cage has to be ${digitList(inOrder.map((e) => e.value))}`,
          'Cage combination',
          highlight,
          { kind: 'place', cells: places },
        ),
      );
      continue;
    }

    // Narrowed: the digits are pinned, their arrangement is not.
    const allowed = digitsToMask(multiset);
    const removals: Array<{ cell: CellIndex; digits: number[] }> = [];
    for (const cell of info.cells) {
      if (ctx.values[cell] !== null && ctx.values[cell] !== undefined) continue;
      const gone = maskToDigits(ctx.visible[cell] & ~allowed, ctx.size);
      if (gone.length > 0) removals.push({ cell, digits: gone });
    }
    if (removals.length === 0) continue;

    const losing = new Set(removals.map((r) => r.cell));
    const highlight = emptyHighlight();
    highlight.focus = info.cells.filter((c) => losing.has(c));
    highlight.support = info.cells.filter((c) => !losing.has(c));
    highlight.cages = [info.cage.id];
    highlight.strike = removals.map((r) => ({ cell: r.cell, digits: r.digits }));

    const gone = removedDigits(removals);
    out.push(
      makeHint(
        'single-cage-combination',
        // "Here" only works while the strike lands on one cell. Widen it to the
        // cage rather than list co-ordinates: the digits are barred from all of
        // it, so the wider claim is the true one anyway.
        removals.length === 1 ? ruledOutHere(gone) : `${digitList(gone)} cannot go in this cage`,
        'Cage combination',
        highlight,
        { kind: 'eliminate', cells: removals },
      ),
    );
  }
  return out;
};

/** rank 40. One digit left in the cell. */
const detectNakedSingle: Detector = (ctx) => {
  const out: Hint[] = [];
  // The cage's combinations *before* any propagation: what the cage alone
  // says, with no help from the player's entries. This is what decides the
  // wording, and only the wording.
  const rawUnions = new Map<number, number[]>();
  const rawUnionFor = (cageIndex: number): number[] => {
    const cached = rawUnions.get(cageIndex);
    if (cached) return cached;
    const info = ctx.state.cages[cageIndex];
    const raw = enumerateCageCombos(info.cage, ctx.size) ?? [];
    const unions = info.cells.map((_, k) => {
      let mask = 0;
      for (const combo of raw) mask |= bit(combo[k]);
      return mask;
    });
    rawUnions.set(cageIndex, unions);
    return unions;
  };

  for (let cell = 0; cell < ctx.size * ctx.size; cell++) {
    if (ctx.values[cell] !== null && ctx.values[cell] !== undefined) continue;
    const digit = soleDigit(ctx.book[cell]);
    if (digit === 0) continue;

    const peers = peersOf(cell, ctx.size);
    const filledPeers = peers.filter(
      (p) => ctx.values[p] !== null && ctx.values[p] !== undefined,
    );
    let peersAlone = ctx.state.full;
    for (const p of filledPeers) peersAlone &= ~bit(ctx.values[p] as number);

    const cageIndex = ctx.cageOfCell[cell];
    // Every cell of a well-formed puzzle belongs to a cage. One that does not
    // has no story to tell beyond its peers, so say nothing about it at all
    // rather than emit a sentence with a hole where the cage label goes.
    if (cageIndex < 0) continue;
    const info = ctx.state.cages[cageIndex];
    const cageAlone = rawUnionFor(cageIndex)[info.cells.indexOf(cell)];

    // Prefer the simpler story when both hold: "its row and column already use
    // everything else" needs no knowledge of cages at all. The text no longer
    // spells the reason out, but the highlight still shows it, and which cells
    // it points at depends entirely on this.
    const reason: 'peers' | 'cage' | 'mixed' =
      popcount(peersAlone) === 1 ? 'peers' : popcount(cageAlone) === 1 ? 'cage' : 'mixed';

    const highlight = emptyHighlight();
    highlight.focus = [cell];
    const cageMates = info.cells.filter((c) => c !== cell);
    highlight.support =
      reason === 'cage'
        ? cageMates
        : reason === 'peers'
          ? filledPeers
          : ascending([...filledPeers, ...cageMates]);
    if (reason !== 'cage') {
      highlight.rows = [rowOf(cell, ctx.size)];
      highlight.cols = [colOf(cell, ctx.size)];
    }
    highlight.cages = [info.cage.id];

    out.push(
      makeHint(
        'naked-single',
        placedHere(digit),
        'Naked single',
        highlight,
        { kind: 'place', cells: [{ cell, value: digit }] },
      ),
    );
  }
  return out;
};

/** rank 50. Only one cell of the row or column can still take the digit. */
const detectHiddenSingle: Detector = (ctx) => {
  const out: Hint[] = [];
  for (let key = 0; key < ctx.units.length; key++) {
    const members = ctx.units[key];
    for (let digit = 1; digit <= ctx.size; digit++) {
      const homes = members.filter((c) => (ctx.book[c] & bit(digit)) !== 0);
      if (homes.length !== 1) continue;
      const cell = homes[0];
      if (ctx.values[cell] !== null && ctx.values[cell] !== undefined) continue;
      // A cell down to one candidate is a naked single, which rank 40 already
      // phrases better. Reporting it here too would only ever be shadowed.
      if (popcount(ctx.book[cell]) <= 1) continue;

      const highlight = emptyHighlight();
      highlight.focus = [cell];
      highlight.support = members.filter((c) => c !== cell);
      Object.assign(highlight, unitBand(key, ctx.size));

      out.push(
        makeHint(
          'hidden-single',
          `Only ${digit} can go here in ${unitName(key, ctx.size)}`,
          'Hidden single',
          highlight,
          { kind: 'place', cells: [{ cell, value: digit }] },
        ),
      );
    }
  }
  return out;
};

/** rank 60. The row/column total, with one cell uncovered. */
const detectUnitSumInnie: Detector = (ctx) => {
  return findInnies(ctx.state).map((found) => {
    const kind = unitKind(found.unitKey, ctx.size);

    const highlight = emptyHighlight();
    highlight.focus = [found.cell];
    highlight.support = ascending(
      found.insideCages.flatMap((ci) => ctx.state.cages[ci].cells),
    );
    highlight.cages = found.insideCages.map((ci) => ctx.puzzle.cages[ci].id);
    Object.assign(highlight, unitBand(found.unitKey, ctx.size));

    return makeHint(
      'unit-sum-innie',
      placedHere(found.digit),
      `${capitalize(kind)} total (innie)`,
      highlight,
      { kind: 'place', cells: [{ cell: found.cell, value: found.digit }] },
    );
  });
};

/** rank 70. The row/column total, with one cage poking out of it. */
const detectUnitSumOutie: Detector = (ctx) => {
  return findOuties(ctx.state).map((found) => {
    const kind = unitKind(found.unitKey, ctx.size);

    const highlight = emptyHighlight();
    highlight.focus = [found.cell];
    highlight.support = ascending([
      ...found.insideCages.flatMap((ci) => ctx.state.cages[ci].cells),
      ...found.straddlingInside,
    ]);
    highlight.cages = [
      ...found.insideCages.map((ci) => ctx.puzzle.cages[ci].id),
      ctx.puzzle.cages[found.straddlingCage].id,
    ];
    Object.assign(highlight, unitBand(found.unitKey, ctx.size));

    return makeHint(
      'unit-sum-outie',
      placedHere(found.digit),
      `${capitalize(kind)} total (outie)`,
      highlight,
      { kind: 'place', cells: [{ cell: found.cell, value: found.digit }] },
    );
  });
};

/** rank 80. However the cage works out, it puts these digits in this line. */
const detectCageLocksLine: Detector = (ctx) => {
  const out: Hint[] = [];
  for (const info of ctx.state.cages) {
    const list = ctx.combos[info.index];
    if (list.length === 0) continue;

    for (const overlap of info.units) {
      const members = ctx.units[overlap.key];
      const outside = members.filter((c) => ctx.cageOfCell[c] !== info.index);
      if (outside.length === 0) continue;

      // Digits every surviving combination puts somewhere in this unit.
      let forced = ctx.state.full;
      for (const combo of list) {
        let mask = 0;
        for (const p of overlap.positions) mask |= bit(combo[p]);
        forced &= mask;
        if (forced === 0) break;
      }
      if (forced === 0) continue;

      const removals: Array<{ cell: CellIndex; digits: number[] }> = [];
      for (const cell of outside) {
        if (ctx.values[cell] !== null && ctx.values[cell] !== undefined) continue;
        const gone = maskToDigits(ctx.visible[cell] & forced, ctx.size);
        if (gone.length > 0) removals.push({ cell, digits: gone });
      }
      if (removals.length === 0) continue;

      const unit = unitName(overlap.key, ctx.size);

      const highlight = emptyHighlight();
      highlight.focus = removals.map((r) => r.cell);
      highlight.support = overlap.positions.map((p) => info.cells[p]);
      highlight.cages = [info.cage.id];
      highlight.strike = removals.map((r) => ({ cell: r.cell, digits: r.digits }));
      Object.assign(highlight, unitBand(overlap.key, ctx.size));

      const gone = removedDigits(removals);
      out.push(
        makeHint(
          'cage-locks-line',
          // With several cells struck at once "here" would be a lie, and the
          // line is the only honest "where" that needs no co-ordinates.
          removals.length === 1
            ? ruledOutHere(gone)
            : `${digitList(gone)} cannot go anywhere else in ${unit}`,
          'Cage confinement',
          highlight,
          { kind: 'eliminate', cells: removals },
        ),
      );
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Registry                                                             */
/* ------------------------------------------------------------------ */

interface TechniqueSpec {
  id: TechniqueId;
  detect: Detector;
}

/**
 * Every detector this build has code for, in rank order.
 *
 * A Tier 2 technique is added here and switched on by putting its id in
 * `ENABLED_TECHNIQUES`; the selection algorithm never needs to change, because
 * it walks whatever intersection of the two this file declares.
 */
const DETECTORS: readonly TechniqueSpec[] = [
  { id: 'freebie-cage', detect: detectFreebieCage },
  { id: 'last-cell-in-unit', detect: detectLastCellInUnit },
  { id: 'single-cage-combination', detect: detectSingleCageCombination },
  { id: 'naked-single', detect: detectNakedSingle },
  { id: 'hidden-single', detect: detectHiddenSingle },
  { id: 'unit-sum-innie', detect: detectUnitSumInnie },
  { id: 'unit-sum-outie', detect: detectUnitSumOutie },
  { id: 'cage-locks-line', detect: detectCageLocksLine },
];

/**
 * The detector for one technique, or `undefined` when this build has no code
 * for it. Exported so each detector can be exercised on its own against a
 * hand-built `DetectContext`, independent of the ladder's shadowing.
 */
export function detectorFor(id: TechniqueId): Detector | undefined {
  return DETECTORS.find((spec) => spec.id === id)?.detect;
}

/** Techniques this build actually offers, ascending by rank. See §10. */
export const ENABLED_TECHNIQUES: readonly TechniqueId[] = [
  'freebie-cage',
  'last-cell-in-unit',
  'single-cage-combination',
  'naked-single',
  'hidden-single',
  'unit-sum-innie',
  'unit-sum-outie',
  'cage-locks-line',
];

/** The enabled detectors, easiest first. */
function activeDetectors(maxRank: number): TechniqueSpec[] {
  return DETECTORS.filter(
    (spec) => ENABLED_TECHNIQUES.includes(spec.id) && TECHNIQUE_RANK[spec.id] <= maxRank,
  ).sort((a, b) => TECHNIQUE_RANK[a.id] - TECHNIQUE_RANK[b.id]);
}

/* ------------------------------------------------------------------ */
/* Selection (§6.2)                                                     */
/* ------------------------------------------------------------------ */

const chebyshev = (a: CellIndex, b: CellIndex, size: number): number =>
  Math.max(Math.abs(rowOf(a, size) - rowOf(b, size)), Math.abs(colOf(a, size) - colOf(b, size)));

function proximity(hint: Hint, near: CellIndex, size: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (const cell of hint.highlight.focus) best = Math.min(best, chebyshev(cell, near, size));
  return best;
}

const placedCount = (hint: Hint): number =>
  hint.apply.kind === 'place' ? hint.apply.cells.length : 0;

const removedCount = (hint: Hint): number =>
  hint.apply.kind === 'eliminate'
    ? hint.apply.cells.reduce((acc, e) => acc + e.digits.length, 0)
    : 0;

const lowestFocus = (hint: Hint): number =>
  hint.highlight.focus.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...hint.highlight.focus);

/**
 * Pick one hint from the equally-ranked candidates. A total order, so
 * `findHint` is referentially transparent.
 */
export function pickHint(hints: readonly Hint[], near: CellIndex | null, size: number): Hint {
  if (hints.length === 0) throw new Error('pickHint needs at least one candidate');
  return hints.slice().sort((a, b) => {
    // 1. placements before eliminations
    const kindDelta = (a.apply.kind === 'place' ? 0 : 1) - (b.apply.kind === 'place' ? 0 : 1);
    if (kindDelta !== 0) return kindDelta;
    // 2. proximity to what the player is looking at
    if (near !== null && near !== undefined) {
      const delta = proximity(a, near, size) - proximity(b, near, size);
      if (delta !== 0) return delta;
    }
    // 3. more work done
    const placeDelta = placedCount(b) - placedCount(a);
    if (placeDelta !== 0) return placeDelta;
    const removeDelta = removedCount(b) - removedCount(a);
    if (removeDelta !== 0) return removeDelta;
    // 4. determinism
    return lowestFocus(a) - lowestFocus(b);
  })[0];
}

/* ------------------------------------------------------------------ */
/* Degenerate-case wording (§8)                                         */
/* ------------------------------------------------------------------ */

const SOLVED_RESULT: HintResult = {
  kind: 'solved',
  text: 'The grid is complete',
  secondary: 'Solved',
};

const STUCK_RESULT: HintResult = {
  // "I can't find" rather than "there is no": a unique solution always exists,
  // so this only ever means our ladder ran out. See §8.3.
  kind: 'stuck',
  text: "I can't find a next step here",
  secondary: 'No forced step',
};

const VAGUE_MISTAKE = {
  text: "Something on the board doesn't fit",
  secondary: 'Check your work',
};

function mistakeResult(wrong: readonly CellIndex[], revealCell: boolean): HintResult {
  if (!revealCell || wrong.length === 0) {
    return { kind: 'mistake', cells: [...wrong], ...VAGUE_MISTAKE };
  }
  return {
    kind: 'mistake',
    cells: [...wrong],
    text: wrong.length === 1 ? "This cell doesn't fit" : `These ${wrong.length} cells don't fit`,
    secondary: 'Check this cell',
  };
}

/* ------------------------------------------------------------------ */
/* findHint (§6.1)                                                      */
/* ------------------------------------------------------------------ */

/**
 * The easiest deduction available from `values`, or a message explaining why
 * there isn't one.
 *
 * `marks` never affects *what* is deduced, only whether a deduction is novel
 * enough to be worth showing.
 */
export function findHint(
  puzzle: Puzzle,
  values: Grid,
  marks: MarkSets,
  opts: HintOptions = {},
): HintResult {
  const size = puzzle.size;
  const cellCount = size * size;
  const near = opts.near ?? null;
  const recent = opts.recent ?? [];
  const maxRank = opts.maxRank ?? Number.POSITIVE_INFINITY;
  const revealCell = opts.revealMistakeCell ?? true;

  // 1 + 2. A poisoned grid makes every deduction below worthless, so check the
  //        player's entries against the solution before doing any work.
  const wrong: CellIndex[] = [];
  let filled = 0;
  for (let i = 0; i < cellCount; i++) {
    const value = values[i];
    if (value === null || value === undefined) continue;
    filled++;
    if (value !== puzzle.solution[i]) wrong.push(i);
  }
  if (wrong.length > 0) return mistakeResult(wrong, revealCell);
  if (filled === cellCount) return SOLVED_RESULT;

  // 3. Bookkeeping fixpoint. A contradiction here with no wrong cell means the
  //    puzzle data itself is broken, not the player — say so vaguely.
  const ctx = detectContext(puzzle, values, marks);
  if (ctx.state.contradiction) return mistakeResult([], revealCell);

  // 4 + 5. Easiest rank first. `recent` suppresses repeats, but never turns a
  //        real hint into "stuck": if it filters everything, take it again.
  const specs = activeDetectors(maxRank);
  for (const pass of [true, false]) {
    for (const spec of specs) {
      const found = spec.detect(ctx);
      if (found.length === 0) continue;
      const kept = pass ? found.filter((h) => !recent.includes(h.signature)) : found;
      if (kept.length === 0) continue;
      return { kind: 'hint', hint: pickHint(kept, near, size) };
    }
    if (recent.length === 0) break;
  }

  // 6.
  return STUCK_RESULT;
}

/**
 * Last-resort reveal. Sources its digit from `puzzle.solution`, one of the
 * three non-deductive reads of it in this file.
 */
export function revealHint(
  puzzle: Puzzle,
  values: Grid,
  opts: Pick<HintOptions, 'near'> = {},
): Hint {
  const size = puzzle.size;
  const near = opts.near ?? null;
  const book = candidateSets(puzzle, values);

  let best: CellIndex = -1;
  let bestKey: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  for (let cell = 0; cell < size * size; cell++) {
    if (values[cell] !== null && values[cell] !== undefined) continue;
    const key: [number, number, number] = [
      book[cell].length === 0 ? size + 1 : book[cell].length,
      near === null ? 0 : chebyshev(cell, near, size),
      cell,
    ];
    if (best === -1 || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = cell;
      bestKey = key;
    }
  }
  // A full grid has nothing to reveal; name cell 0 rather than throw, so the
  // caller's escape hatch is never itself a crash.
  if (best === -1) best = 0;

  const digit = puzzle.solution[best];
  const highlight = emptyHighlight();
  highlight.focus = [best];
  return makeHint(
    'reveal',
    placedHere(digit),
    'Revealed',
    highlight,
    { kind: 'place', cells: [{ cell: best, value: digit }] },
  );
}

/* ------------------------------------------------------------------ */
/* findNextNumber                                                       */
/* ------------------------------------------------------------------ */

/** One placement, found by running hints forward past elimination-only steps. */
export interface NextNumber {
  cell: CellIndex;
  value: number;
}

/**
 * The first value that would be placed if hints were applied repeatedly.
 *
 * The ladder often answers a fresh board with an elimination — a cage narrowed
 * to two digits, a line a cage has claimed — and a player who asked for *a
 * number* is owed a number, not pencil work. So elimination steps are replayed
 * against a private copy of `marks`, exactly as `APPLY_HINT` would write them,
 * until a placement falls out. The caller's `marks` never see any of it.
 *
 * Returns null when no placement is reachable: a mistake, a stuck ladder, a
 * finished grid, or a search that ran past its cap.
 */
export function findNextNumber(
  puzzle: Puzzle,
  values: Grid,
  marks: MarkSets,
  opts: HintOptions = {},
): NextNumber | null {
  const size = puzzle.size;
  const cellCount = size * size;
  const working: number[][] = Array.from({ length: cellCount }, (_, cell) => [
    ...(marks[cell] ?? []),
  ]);

  // Each elimination strictly narrows what a cell can still show, so the loop
  // ends of its own accord. The cap is a backstop against a detector that ever
  // stops making progress, not the mechanism that terminates the search.
  const cap = cellCount * (size + 2);

  for (let step = 0; step < cap; step++) {
    const result = findHint(puzzle, values, working, opts);
    if (result.kind !== 'hint') return null;

    const { apply } = result.hint;
    if (apply.kind === 'place') {
      let first = apply.cells[0];
      for (const entry of apply.cells) if (entry.cell < first.cell) first = entry;
      return { cell: first.cell, value: first.value };
    }

    // Mirrors `APPLY_HINT`: a bare cell is seeded with what the player could
    // already work out, so the elimination has something to take away from.
    const visible = visibleMasks(puzzle, values, working);
    for (const { cell, digits } of apply.cells) {
      const base = working[cell].length > 0 ? working[cell] : maskToDigits(visible[cell], size);
      working[cell] = base.filter((d) => !digits.includes(d)).sort((a, b) => a - b);
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* checkCorrectness                                                     */
/* ------------------------------------------------------------------ */

/** Filled cells split by agreement with `puzzle.solution`. Empty cells appear in neither. */
export interface CorrectnessReport {
  correct: CellIndex[];
  incorrect: CellIndex[];
}

/**
 * Which of the player's entries are right.
 *
 * Solution-aware on purpose, and that is why it lives here rather than beside
 * `findGridErrors`: `errors.ts` answers "does this board contradict itself",
 * which a player could work out unaided, and it never opens the answer key so
 * that its verdict is always one they could have reached. This answers "am I
 * right", which nothing can answer honestly without looking.
 */
export function checkCorrectness(puzzle: Puzzle, values: Grid): CorrectnessReport {
  const correct: CellIndex[] = [];
  const incorrect: CellIndex[] = [];
  for (let cell = 0; cell < puzzle.size * puzzle.size; cell++) {
    const value = values[cell];
    if (value === null || value === undefined) continue;
    (value === puzzle.solution[cell] ? correct : incorrect).push(cell);
  }
  return { correct, incorrect };
}
