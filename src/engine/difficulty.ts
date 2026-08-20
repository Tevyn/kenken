/**
 * Difficulty tuning.
 *
 * Two separate jobs live here:
 *
 * 1. `paramsFor(size, difficulty)` — the *generation* parameters: how big cages
 *    may get, how many single-cell "freebie" cages are allowed, which operators
 *    may be used and how often. The structural parts (cage size cap, freebie
 *    band, allowed operators) are hard invariants — the generator never returns
 *    a puzzle that violates them.
 *
 * 2. `scorePuzzle(puzzle, stats)` — a 0..100 score computed from solver effort
 *    plus structural features, so generation can accept or reject a candidate.
 *    The bands are non-overlapping, so `tierFromScore` is well defined.
 *
 * Relationship to `docs/KENKEN.md` §4.2 (which is explicitly flagged there as
 * an uncalibrated proposal):
 *
 *  - The per-tier table (max cage size, freebie counts, allowed operators) is
 *    followed where the doc specifies a value, and extrapolated in the same
 *    spirit for the size/tier combinations the doc leaves out (the app offers
 *    all 4 tiers at all 7 sizes).
 *  - `solverEffort()` implements the doc's `effort = B*3 + D*2` exactly.
 *  - The doc's *raw effort thresholds* are deliberately NOT used as the tier
 *    test. With the propagator from §3.1 actually implemented, the large
 *    majority of randomly generated puzzles at every size solve with zero
 *    guesses, so raw effort is 0 far too often to separate tiers; using it
 *    alone would make "expert" unreachable at small sizes and generation
 *    unbounded at large ones. Effort therefore contributes to a composite
 *    score alongside how much of the grid pure propagation gives away, which is
 *    both a better proxy for felt difficulty and something generation can
 *    actually steer.
 *  - Per §4.1 (candidate counting), '-' and '/' cages are *tightening*, so
 *    their weight goes DOWN as the tier goes up. (§2.3 of the doc claims the
 *    opposite; §4.1's argument is the principled one and is what is used here.)
 */

import type { Difficulty, Op, Puzzle } from './types';
import type { SolveStats } from './solver';

export interface DifficultyParams {
  /** Hard cap on cells per cage. Never exceeded. */
  maxCageSize: number;
  /** Relative weight for a cage of size 2..maxCageSize (index = size). */
  cageSizeWeights: number[];
  /** Inclusive band for the number of single-cell '=' cages. Never violated. */
  minFreebies: number;
  maxFreebies: number;
  /** Operators the generator may choose from (besides '=' for single cells). */
  allowedOps: Op[];
  /** Relative weight per operator when several are legal for a cage. */
  opWeights: Record<Op, number>;
  /** Accepted score band: `minScore` inclusive, `maxScore` exclusive. */
  minScore: number;
  maxScore: number;
}

/**
 * Score cut-points `[easyMax, mediumMax, hardMax]`, exclusive upper bounds.
 *
 * These are calibrated from measured score distributions of ~1500 generated
 * puzzles per size/tier, not guessed: each tier's band brackets the median
 * score its generation parameters actually produce, so every band is reachable
 * at every size. Small grids need lower cut-points because their score ceiling
 * is lower (a 3x3 caps out around 39 — its cages simply cannot get big enough
 * to score higher).
 */
function cutPointsFor(size: number): [number, number, number] {
  if (size <= 3) return [10, 20, 30];
  if (size <= 5) return [10, 26, 38];
  return [10, 26, 40];
}

const TIER_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

/** Score band for a tier at a size, as `[minInclusive, maxExclusive]`. */
export function scoreBand(size: number, difficulty: Difficulty): [number, number] {
  const cuts = cutPointsFor(size);
  const index = TIER_ORDER.indexOf(difficulty);
  if (index === -1) throw new RangeError(`Unknown difficulty: ${String(difficulty)}`);
  const lo = index === 0 ? 0 : cuts[index - 1];
  const hi = index === TIER_ORDER.length - 1 ? 101 : cuts[index];
  return [lo, hi];
}

/**
 * Freebie ('=' cage) counts, following `docs/KENKEN.md` §4.2: hard and expert
 * get none at all, medium at most a couple, easy a handful. The bands are
 * arranged so they never overlap for a given size, which makes the freebie
 * count an always-true structural signal of the requested tier.
 */
export function freebieBounds(size: number, difficulty: Difficulty): { min: number; max: number } {
  const cells = size * size;
  switch (difficulty) {
    case 'easy': {
      const min = Math.max(1, Math.ceil(0.1 * cells));
      const max = Math.max(2, Math.floor(0.2 * cells));
      return { min, max };
    }
    case 'medium': {
      const max = Math.floor(0.08 * cells);
      return { min: Math.min(1, max), max };
    }
    case 'hard':
    case 'expert':
      return { min: 0, max: 0 };
  }
}

/**
 * Max cells per cage. Matches `docs/KENKEN.md` §4.2 wherever the table gives a
 * value, and stays within its §3.3 advice to cap around 4-5 even at 9x9.
 */
function maxCageSizeFor(size: number, difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return size <= 4 ? 2 : 3;
    case 'medium':
      return size <= 6 ? 3 : 4;
    case 'hard':
      return size <= 4 ? 3 : 4;
    case 'expert':
      return size <= 3 ? 3 : size <= 5 ? 4 : 5;
  }
}

/**
 * Allowed operators. §4.2: 3x3 easy is `+`/`x` only, 4x4 and 5x5 easy add `-`,
 * everything else uses all four.
 */
function allowedOpsFor(size: number, difficulty: Difficulty): Op[] {
  if (difficulty === 'easy') {
    if (size <= 3) return ['+', '*'];
    if (size <= 5) return ['+', '-', '*'];
  }
  return ['+', '-', '*', '/'];
}

/**
 * Operator weights. Tight operators ('-', '/') dominate at easy and fade out
 * toward expert, per §4.1: they slash the candidate-combination count, which
 * makes a cage easier, not harder.
 */
const OP_WEIGHTS: Record<Difficulty, Record<Op, number>> = {
  easy: { '+': 4, '-': 5, '*': 2, '/': 4, '=': 1 },
  medium: { '+': 5, '-': 4, '*': 4, '/': 3, '=': 1 },
  hard: { '+': 6, '-': 2.5, '*': 6, '/': 2, '=': 1 },
  expert: { '+': 7, '-': 1.5, '*': 7, '/': 1, '=': 1 },
};

/**
 * Cage-size distribution (index === cage size). Freebies are placed separately,
 * so index 1 is unused. Weights skew larger as the tier goes up, per §2.2/§4.1;
 * the shape is CanCan's `{2: 35%, 3: 35%, 4: 20%, 5: 5%}` pushed toward the
 * bigger end for hard/expert.
 */
const CAGE_SIZE_WEIGHTS: Record<Difficulty, number[]> = {
  easy: [0, 0, 8, 3, 0, 0],
  medium: [0, 0, 6, 4, 1.5, 0],
  hard: [0, 0, 3.5, 4.5, 2.5, 0.75],
  expert: [0, 0, 2, 4.5, 3.5, 1.5],
};

/** Generation parameters for a grid size / tier. Throws for unknown inputs. */
export function paramsFor(size: number, difficulty: Difficulty): DifficultyParams {
  if (!TIER_ORDER.includes(difficulty)) {
    throw new RangeError(`Unknown difficulty: ${String(difficulty)}`);
  }
  const maxCageSize = Math.min(maxCageSizeFor(size, difficulty), size * size);
  const weights = CAGE_SIZE_WEIGHTS[difficulty].slice(0, maxCageSize + 1);
  // 5-cell cages are by far the biggest generation-latency cost at 8x8/9x9
  // (docs/KENKEN.md §3.3): their combination lists are an order of magnitude
  // longer than a 4-cell cage's. Keep them as flavour, not as the norm.
  if (size >= 8 && weights.length > 5) weights[5] *= 0.4;
  const { min, max } = freebieBounds(size, difficulty);
  const [minScore, maxScore] = scoreBand(size, difficulty);

  return {
    maxCageSize,
    cageSizeWeights: weights,
    minFreebies: min,
    maxFreebies: max,
    allowedOps: allowedOpsFor(size, difficulty),
    opWeights: OP_WEIGHTS[difficulty],
    minScore,
    maxScore,
  };
}

/** `docs/KENKEN.md` §4.2: `effort = B*3 + D*2`. Zero when propagation suffices. */
export function solverEffort(stats: SolveStats): number {
  return stats.guesses * 3 + stats.maxDepth * 2;
}

export interface PuzzleMetrics {
  /** Number of single-cell cages. */
  freebies: number;
  freebieRatio: number;
  avgCageSize: number;
  maxCageSize: number;
  /** Share of multi-cell cages using a tightening operator ('-' or '/'). */
  tightOpRatio: number;
  /** `B*3 + D*2` from the solver run. */
  effort: number;
  /** Fraction of cells the very first propagation pass pinned down. */
  propagationCoverage: number;
  /** 0..100. */
  score: number;
}

/**
 * Difficulty score: structural features plus solver effort.
 *
 * - `propagationCoverage` is "how much of the grid the cheap logic hands you",
 *   the single most reliable separator between tiers in practice.
 * - `effort` (the doc's B*3 + D*2) pushes a puzzle up when real search is
 *   needed; it is log-scaled because the first guess matters far more than the
 *   twentieth.
 * - Freebies, average cage size and the operator mix are the structural knobs
 *   generation controls directly.
 */
export function scorePuzzle(puzzle: Puzzle, stats: SolveStats): PuzzleMetrics {
  const cells = puzzle.size * puzzle.size;
  const cageCount = puzzle.cages.length;
  const freebies = puzzle.cages.filter((c) => c.cells.length === 1).length;
  const multi = puzzle.cages.filter((c) => c.cells.length > 1);
  const tight = multi.filter((c) => c.op === '-' || c.op === '/').length;

  const freebieRatio = freebies / cells;
  const avgCageSize = cageCount === 0 ? 0 : cells / cageCount;
  const maxCageSize = puzzle.cages.reduce((m, c) => Math.max(m, c.cells.length), 0);
  const tightOpRatio = multi.length === 0 ? 0 : tight / multi.length;
  const propagationCoverage = stats.solvedByPropagation / cells;
  const effort = solverEffort(stats);

  // Structural component.
  const structural =
    24 * clamp(avgCageSize - 1.7, 0, 2.3) - 60 * freebieRatio - 14 * tightOpRatio + 8;

  // Logical component: what the cheap rules leave undone, plus real searching.
  const logical = 40 * (1 - propagationCoverage) + 11 * Math.log2(1 + effort);

  const score = clamp(Math.round(structural + logical), 0, 100);

  return {
    freebies,
    freebieRatio,
    avgCageSize,
    maxCageSize,
    tightOpRatio,
    effort,
    propagationCoverage,
    score,
  };
}

/** The tier a score falls into at a given size. Bands are non-overlapping. */
export function tierFromScore(score: number, size: number): Difficulty {
  const cuts = cutPointsFor(size);
  for (let i = 0; i < cuts.length; i++) {
    if (score < cuts[i]) return TIER_ORDER[i];
  }
  return 'expert';
}

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}
