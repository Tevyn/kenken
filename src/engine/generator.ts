/**
 * Puzzle generation pipeline (`docs/KENKEN.md` §2):
 *
 *   Latin square  ->  cage partition  ->  operators/targets  ->  uniqueness
 *
 * Everything is driven by a single seeded PRNG stream, so the same
 * `{size, difficulty, seed}` always yields exactly the same puzzle.
 *
 * When a candidate is not uniquely solvable we repair from cheapest to most
 * expensive, per §2.4:
 *   1. re-roll the operators of the cages covering the cells where the two
 *      solutions disagree,
 *   2. re-roll every operator,
 *   3. re-partition the grid,
 *   4. start over from a new Latin square.
 *
 * Splitting a cage (also listed in §2.4) is deliberately not used: hard and
 * expert forbid single-cell cages outright, so the usual "peel off a freebie"
 * split would break a hard invariant. Re-rolling and re-partitioning converge
 * quickly enough that it is not needed.
 */

import type { Cage, GenerateOptions, Puzzle } from './types';
import { MAX_SIZE, MIN_SIZE } from './types';
import { makeRng, randomSeed } from './rng';
import type { Rng } from './rng';
import { generateLatinSquare } from './latin';
import { assignCageOps, legalOps, partitionCages } from './cages';
import type { DifficultyParams, PuzzleMetrics } from './difficulty';
import { paramsFor, scorePuzzle } from './difficulty';
import { solve } from './solver';

/** Tunables for the retry pipeline. All budgets are iteration counts, never clocks. */
export interface GeneratorBudget {
  latinAttempts: number;
  partitionAttempts: number;
  opAttempts: number;
  /** Local operator repairs tried per ambiguous candidate. */
  repairAttempts: number;
  /** Hard ceiling on uniqueness solves, across the whole call. */
  maxSolveCalls: number;
  /** Candidates whose cage combinations total more than this are skipped. */
  maxTotalCombos: number;
  /** Candidates with any single cage above this combination count are skipped. */
  maxCombosPerCage: number;
  /** Node budget handed to each uniqueness solve. */
  solveNodeLimit: number;
}

/**
 * Defaults tuned by measurement, not guesswork:
 *
 *  - Partition diversity is what actually finds unique puzzles. Ambiguity is an
 *    inter-cage symmetry (§2.4), so it is a property of the *shape*: some
 *    partitions produce a unique puzzle for a quarter of their operator
 *    assignments, others for none at all. Hence few operator attempts per
 *    partition and many partitions.
 *  - `solveNodeLimit` is deliberately small. Per §3.3, a candidate that needs
 *    thousands of branches to verify is not worth waiting for — rejecting it
 *    and trying another is much cheaper than proving it unique.
 */
export const DEFAULT_BUDGET: GeneratorBudget = {
  latinAttempts: 24,
  partitionAttempts: 20,
  opAttempts: 3,
  repairAttempts: 1,
  maxSolveCalls: 500,
  maxTotalCombos: 60_000,
  maxCombosPerCage: 3_000,
  solveNodeLimit: 600,
};

export interface GenerationResult {
  puzzle: Puzzle;
  metrics: PuzzleMetrics;
  /** True when the puzzle landed inside its tier's score band. */
  inBand: boolean;
  /** Uniqueness solves performed. Useful for perf tests. */
  solveCalls: number;
}

/**
 * Generate a puzzle with exactly one solution.
 * Throws `RangeError` for a size outside 3..9 or an unknown difficulty.
 */
export function generatePuzzle(options: GenerateOptions): Puzzle {
  return generateWithMetrics(options).puzzle;
}

/** Same as `generatePuzzle`, but also reports how the puzzle scored. */
export function generateWithMetrics(
  options: GenerateOptions,
  budget: GeneratorBudget = DEFAULT_BUDGET,
): GenerationResult {
  const { size, difficulty } = options;
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(`Grid size must be an integer in ${MIN_SIZE}..${MAX_SIZE}, got ${size}`);
  }
  const params = paramsFor(size, difficulty);

  const seed = options.seed ?? randomSeed();
  const rng = makeRng(`kenken/v1/${size}/${difficulty}/${seed}`);

  let best: GenerationResult | null = null;
  let solveCalls = 0;
  /** Diagnostic only: reported in the (should-be-unreachable) failure message. */
  let uniqueFound = 0;

  const consider = (
    cages: Cage[],
    solution: number[],
  ): { unique: boolean; result?: GenerationResult; diff?: number[] } => {
    const puzzle: Puzzle = { size, difficulty, cages, solution: solution.slice(), seed };
    solveCalls++;
    const res = solve(puzzle, {
      limit: 2,
      nodeLimit: budget.solveNodeLimit,
      maxCombosPerCage: budget.maxCombosPerCage,
    });
    if (res.aborted || res.stats.totalCombos > budget.maxTotalCombos) {
      return { unique: false };
    }
    if (res.solutions.length !== 1) {
      const diff =
        res.solutions.length === 2 ? differingCells(res.solutions[0], res.solutions[1]) : undefined;
      return { unique: false, diff };
    }
    // Score against the effort needed to *find* the solution, not the effort
    // spent proving there is no second one — the latter explores the whole
    // tree and says more about the search order than about the puzzle.
    const solveOnly = solve(puzzle, { limit: 1, nodeLimit: budget.solveNodeLimit });
    const metrics = scorePuzzle(puzzle, solveOnly.stats);
    const inBand = metrics.score >= params.minScore && metrics.score < params.maxScore;
    return { unique: true, result: { puzzle, metrics, inBand, solveCalls } };
  };

  const keep = (candidate: GenerationResult): void => {
    const current: GenerationResult | null = best;
    if (
      current === null ||
      bandDistance(candidate.metrics.score, params) < bandDistance(current.metrics.score, params)
    ) {
      best = candidate;
    }
  };

  // Rounds exist purely as insurance. Measured across every size/tier, a first
  // in-band puzzle turns up within ~100 solves; a second round has never been
  // needed. It costs nothing when unused and keeps a pathological seed from
  // failing outright. The PRNG stream simply continues, so this stays
  // deterministic.
  for (let round = 0; round < 3; round++) {
    if (best !== null) break;
    const callCap = budget.maxSolveCalls * (round + 1);

    outer: for (let latinAttempt = 0; latinAttempt < budget.latinAttempts; latinAttempt++) {
      const solution = generateLatinSquare(size, rng);

      for (let partAttempt = 0; partAttempt < budget.partitionAttempts; partAttempt++) {
        const partition = partitionCages(size, rng, params);

        for (let opAttempt = 0; opAttempt < budget.opAttempts; opAttempt++) {
          if (solveCalls >= callCap) break outer;

          let cages = assignCageOps(partition, solution, rng, params);
          let outcome = consider(cages, solution);

          // Local repair: re-roll only the cages covering the disputed cells.
          // Worth a solve only when the ambiguity really is local — when the two
          // solutions differ nearly everywhere (a row-swap symmetry, the common
          // case) "re-roll the touched cages" degenerates into re-rolling all of
          // them, which is no better than the fresh assignment we just tried.
          for (let repair = 0; !outcome.unique && repair < budget.repairAttempts; repair++) {
            if (!outcome.diff || outcome.diff.length > size * 2) break;
            if (solveCalls >= callCap) break;
            const next = rerollCages(cages, outcome.diff, solution, rng, params);
            if (!next) break;
            cages = next;
            outcome = consider(cages, solution);
          }

          if (outcome.unique && outcome.result) {
            uniqueFound++;
            if (outcome.result.inBand) {
              return { ...outcome.result, solveCalls };
            }
            keep(outcome.result);
          }
        }
      }
    }
  }

  if (best === null) {
    throw new Error(
      `Failed to generate a unique ${size}x${size} ${difficulty} puzzle for seed "${seed}" (calls=${solveCalls}, unique=${uniqueFound})`,
    );
  }
  return { ...(best as GenerationResult), solveCalls };
}

/** How far a score sits outside its tier's band (0 when inside). */
function bandDistance(score: number, params: DifficultyParams): number {
  if (score < params.minScore) return params.minScore - score;
  if (score >= params.maxScore) return score - params.maxScore + 1;
  return 0;
}

/** Cells where two solution grids disagree. */
function differingCells(a: readonly number[], b: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) out.push(i);
  }
  return out;
}

/**
 * Re-roll the operator/target of every cage touching one of `cells`, forcing a
 * different operator where an alternative exists. Returns null when no cage
 * could be changed (all of them have a single legal operator).
 */
function rerollCages(
  cages: readonly Cage[],
  cells: readonly number[],
  solution: readonly number[],
  rng: Rng,
  params: DifficultyParams,
): Cage[] | null {
  const touched = new Set<number>();
  const wanted = new Set(cells);
  for (const cage of cages) {
    if (cage.cells.some((c) => wanted.has(c))) touched.add(cage.id);
  }
  if (touched.size === 0) return null;

  let changed = false;
  const next = cages.map((cage) => {
    if (!touched.has(cage.id) || cage.cells.length === 1) return cage;
    const values = cage.cells.map((c) => solution[c]);
    const choices = legalOps(values, params.allowedOps).filter((c) => c.op !== cage.op);
    if (choices.length === 0) return cage;
    const pick = rng.weightedPick(
      choices,
      choices.map((c) => params.opWeights[c.op] ?? 1),
    );
    changed = true;
    return { ...cage, op: pick.op, target: pick.target };
  });

  return changed ? next : null;
}
