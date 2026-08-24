/**
 * KenKen solver.
 *
 * Rather than backtracking cell by cell, the solver works on *cage
 * combinations*: for every cage it enumerates all digit assignments that
 * satisfy the cage's arithmetic and the row/column uniqueness rule *within* the
 * cage. Those combination lists are then pruned by constraint propagation:
 *
 *  - candidate intersection (a cell may only hold digits some surviving
 *    combination of its cage assigns it),
 *  - naked singles (a solved cell removes its digit from row/column peers),
 *  - hidden singles (a digit with a single possible cell in a row/column),
 *  - locked candidates / cage confinement, in both directions:
 *      * if every surviving combination of a cage places digit v inside row r,
 *        no other cell of row r can be v;
 *      * if the only cells in row r that can be v all belong to one cage, that
 *        cage must place v inside row r.
 *
 * Only when propagation reaches a fixpoint does it branch, most-constrained
 * cage first (fewest surviving combinations).
 */

import type { Cage, Puzzle } from './types';

export interface SolveStats {
  /** Branch points expanded during search. */
  nodes: number;
  /** Total branches tried — the primary "solver effort" signal (`B`). */
  guesses: number;
  /** Deepest branch nesting reached (`D`). 0 when propagation alone suffices. */
  maxDepth: number;
  /** Propagation rounds executed. */
  propagations: number;
  /** Candidate bits removed by propagation. */
  eliminations: number;
  /** Largest per-cage combination count after enumeration. */
  maxCageCombos: number;
  /** Sum of per-cage combination counts after enumeration. */
  totalCombos: number;
  /** Combinations remaining after the initial propagation pass. */
  combosAfterPropagation: number;
  /** Cells solved by the initial propagation pass alone (no guessing). */
  solvedByPropagation: number;
}

export interface SolveOptions {
  /** Stop after this many solutions. Default 1. */
  limit?: number;
  /** Give up if any single cage has more combinations than this. */
  maxCombosPerCage?: number;
  /** Give up after this many branches. */
  nodeLimit?: number;
}

export interface SolveResult {
  solutions: number[][];
  stats: SolveStats;
  /** The solver bailed out (combination explosion or node limit) — results are partial. */
  aborted: boolean;
  /** The cage constraints are provably unsatisfiable. */
  infeasible: boolean;
}

export const DEFAULT_MAX_COMBOS_PER_CAGE = 120_000;
export const DEFAULT_NODE_LIMIT = 400_000;

/** Cages with more combinations than this are skipped by the expensive rules. */
const DEEP_RULE_COMBO_LIMIT = 4000;

interface CageUnit {
  /** Row `r` is key `r`; column `c` is key `size + c`. */
  key: number;
  /** Positions within `cage.cells` that fall in this unit. */
  positions: number[];
}

interface CageInfo {
  cells: number[];
  units: CageUnit[];
}

interface Context {
  size: number;
  cellCount: number;
  full: number;
  cages: CageInfo[];
  /** cell index -> cage index */
  cageOfCell: Int32Array;
  /** unit key -> member cell indices */
  units: number[][];
  stats: SolveStats;
  nodeLimit: number;
  aborted: boolean;
}

interface State {
  cands: Int32Array;
  combos: number[][][];
}

function emptyStats(): SolveStats {
  return {
    nodes: 0,
    guesses: 0,
    maxDepth: 0,
    propagations: 0,
    eliminations: 0,
    maxCageCombos: 0,
    totalCombos: 0,
    combosAfterPropagation: 0,
    solvedByPropagation: 0,
  };
}

/**
 * Enumerate every digit assignment for one cage that satisfies its arithmetic
 * and does not repeat a digit within a row or column *of the cage*.
 * Returns `null` when the count would exceed `cap`.
 */
export function enumerateCageCombos(
  cage: Cage,
  size: number,
  cap: number = DEFAULT_MAX_COMBOS_PER_CAGE,
): number[][] | null {
  const cells = cage.cells;
  const n = cells.length;
  const rows = cells.map((c) => (c / size) | 0);
  const cols = cells.map((c) => c % size);
  const rowUsed = new Array<number>(size).fill(0);
  const colUsed = new Array<number>(size).fill(0);
  const out: number[][] = [];
  const current = new Array<number>(n).fill(0);
  const target = cage.target;

  if (n === 1) {
    // A single cell only makes sense for '=', '+' or '*', all of which mean
    // "this cell equals the target".
    if (cage.op === '-' || cage.op === '/') return [];
    if (target >= 1 && target <= size) return [[target]];
    return [];
  }
  // '=' is by definition a single-cell cage; '-' and '/' are strictly 2 cells.
  if (cage.op === '=') return [];
  if ((cage.op === '-' || cage.op === '/') && n !== 2) return [];

  let overflow = false;

  const recurse = (k: number, sum: number, product: number): void => {
    if (overflow) return;
    if (k === n) {
      if (cage.op === '+' && sum !== target) return;
      if (cage.op === '*' && product !== target) return;
      if (cage.op === '-' && Math.abs(current[0] - current[1]) !== target) return;
      if (cage.op === '/') {
        const hi = Math.max(current[0], current[1]);
        const lo = Math.min(current[0], current[1]);
        if (lo === 0 || hi % lo !== 0 || hi / lo !== target) return;
      }
      out.push(current.slice());
      if (out.length > cap) overflow = true;
      return;
    }

    const remaining = n - k - 1;
    for (let v = 1; v <= size; v++) {
      const bit = 1 << (v - 1);
      if ((rowUsed[rows[k]] & bit) !== 0) continue;
      if ((colUsed[cols[k]] & bit) !== 0) continue;

      if (cage.op === '+') {
        const nextSum = sum + v;
        if (nextSum + remaining > target) break; // v only grows from here
        if (nextSum + remaining * size < target) continue;
      } else if (cage.op === '*') {
        const nextProduct = product * v;
        if (nextProduct > target) break;
        if (target % nextProduct !== 0) continue;
      }

      current[k] = v;
      rowUsed[rows[k]] |= bit;
      colUsed[cols[k]] |= bit;
      recurse(k + 1, sum + v, product * v);
      rowUsed[rows[k]] &= ~bit;
      colUsed[cols[k]] &= ~bit;
      current[k] = 0;
      if (overflow) return;
    }
  };

  recurse(0, 0, 1);
  if (overflow) return null;
  return out;
}

function buildContext(
  puzzle: Puzzle,
  maxCombos: number,
  nodeLimit: number,
): {
  ctx: Context;
  state: State | null;
} {
  const size = puzzle.size;
  const cellCount = size * size;
  const stats = emptyStats();

  const cageOfCell = new Int32Array(cellCount).fill(-1);
  const infos: CageInfo[] = [];
  const combos: number[][][] = [];

  const units: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) row.push(r * size + c);
    units.push(row);
  }
  for (let c = 0; c < size; c++) {
    const col: number[] = [];
    for (let r = 0; r < size; r++) col.push(r * size + c);
    units.push(col);
  }

  const ctx: Context = {
    size,
    cellCount,
    full: (1 << size) - 1,
    cages: infos,
    cageOfCell,
    units,
    stats,
    nodeLimit,
    aborted: false,
  };

  for (let ci = 0; ci < puzzle.cages.length; ci++) {
    const cage = puzzle.cages[ci];
    const cells = cage.cells.slice();
    for (const cell of cells) cageOfCell[cell] = ci;

    const byUnit = new Map<number, number[]>();
    for (let k = 0; k < cells.length; k++) {
      const rowKey = (cells[k] / size) | 0;
      const colKey = size + (cells[k] % size);
      for (const key of [rowKey, colKey]) {
        const list = byUnit.get(key);
        if (list) list.push(k);
        else byUnit.set(key, [k]);
      }
    }
    const unitList: CageUnit[] = [];
    for (const [key, positions] of byUnit) {
      if (positions.length > 0) unitList.push({ key, positions });
    }
    infos.push({ cells, units: unitList });

    const list = enumerateCageCombos(cage, size, maxCombos);
    if (list === null) {
      ctx.aborted = true;
      return { ctx, state: null };
    }
    stats.totalCombos += list.length;
    if (list.length > stats.maxCageCombos) stats.maxCageCombos = list.length;
    combos.push(list);
  }

  const cands = new Int32Array(cellCount).fill(ctx.full);
  return { ctx, state: { cands, combos } };
}

function popcount(mask: number): number {
  let m = mask - ((mask >> 1) & 0x55555555);
  m = (m & 0x33333333) + ((m >> 2) & 0x33333333);
  m = (m + (m >> 4)) & 0x0f0f0f0f;
  return (m * 0x01010101) >> 24;
}

/** -1 = contradiction, 0 = no change, 1 = something changed. */
type RuleOutcome = -1 | 0 | 1;

/** Propagate to a fixpoint. Returns false on contradiction. */
function propagate(ctx: Context, st: State): boolean {
  const { size, cellCount, cages, units, cageOfCell, stats } = ctx;
  const cands = st.cands;

  // A cage's combination list only needs re-filtering when one of its own
  // cells lost a candidate. Rescanning every cage every round is the single
  // most expensive thing a naive implementation does, so track which are
  // stale. Narrowing a cell to what its own cage already offers (rule A) can
  // never invalidate a surviving combination of that same cage, so only the
  // cross-cage rules below dirty anything.
  const stale = new Uint8Array(cages.length).fill(1);
  const touch = (cell: number): void => {
    const owner = cageOfCell[cell];
    if (owner >= 0) stale[owner] = 1;
  };

  /** Cheap rules: combination filtering, naked singles, hidden singles. */
  const shallow = (): RuleOutcome => {
    let changed = false;
    stats.propagations++;

    // (A) drop combinations that need a digit a cell can no longer hold, then
    //     intersect each cell's candidates with what its cage still offers.
    for (let ci = 0; ci < cages.length; ci++) {
      if (stale[ci] === 0) continue;
      stale[ci] = 0;
      const info = cages[ci];
      const cells = info.cells;
      const n = cells.length;
      const list = st.combos[ci];
      let kept: number[][] | null = null;

      for (let i = 0; i < list.length; i++) {
        const combo = list[i];
        let ok = true;
        for (let k = 0; k < n; k++) {
          if ((cands[cells[k]] & (1 << (combo[k] - 1))) === 0) {
            ok = false;
            break;
          }
        }
        if (ok) {
          if (kept !== null) kept.push(combo);
        } else if (kept === null) {
          kept = list.slice(0, i);
        }
      }
      if (kept !== null) {
        if (kept.length === 0) return -1;
        st.combos[ci] = kept;
        changed = true;
      }

      const survivors = st.combos[ci];
      for (let k = 0; k < n; k++) {
        let union = 0;
        for (let i = 0; i < survivors.length; i++) union |= 1 << (survivors[i][k] - 1);
        const cell = cells[k];
        const next = cands[cell] & union;
        if (next !== cands[cell]) {
          if (next === 0) return -1;
          stats.eliminations += popcount(cands[cell]) - popcount(next);
          cands[cell] = next;
          changed = true;
        }
      }
    }

    // (B) naked singles: a solved cell clears its digit from row/column peers.
    for (let cell = 0; cell < cellCount; cell++) {
      const mask = cands[cell];
      if (mask === 0) return -1;
      if ((mask & (mask - 1)) !== 0) continue;
      const row = (cell / size) | 0;
      const col = cell % size;
      for (let c = 0; c < size; c++) {
        const peer = row * size + c;
        if (peer !== cell && (cands[peer] & mask) !== 0) {
          const next = cands[peer] & ~mask;
          if (next === 0) return -1;
          cands[peer] = next;
          touch(peer);
          stats.eliminations++;
          changed = true;
        }
      }
      for (let r = 0; r < size; r++) {
        const peer = r * size + col;
        if (peer !== cell && (cands[peer] & mask) !== 0) {
          const next = cands[peer] & ~mask;
          if (next === 0) return -1;
          cands[peer] = next;
          touch(peer);
          stats.eliminations++;
          changed = true;
        }
      }
    }

    // (C) hidden singles: a digit with exactly one home in a row/column.
    for (let u = 0; u < units.length; u++) {
      const members = units[u];
      for (let v = 1; v <= size; v++) {
        const bit = 1 << (v - 1);
        let count = 0;
        let where = -1;
        for (let i = 0; i < members.length; i++) {
          if ((cands[members[i]] & bit) !== 0) {
            count++;
            where = members[i];
            if (count > 1) break;
          }
        }
        if (count === 0) return -1;
        if (count === 1 && cands[where] !== bit) {
          stats.eliminations += popcount(cands[where]) - 1;
          cands[where] = bit;
          touch(where);
          changed = true;
        }
      }
    }

    return changed ? 1 : 0;
  };

  /** Expensive rules: locked candidates between cages and rows/columns. */
  const deep = (): RuleOutcome => {
    let changed = false;
    stats.propagations++;

    // (D1) cage -> unit: digits every surviving combination places inside a
    //      unit cannot appear elsewhere in that unit.
    for (let ci = 0; ci < cages.length; ci++) {
      const list = st.combos[ci];
      if (list.length === 0) return -1;
      if (list.length > DEEP_RULE_COMBO_LIMIT) continue;
      const info = cages[ci];
      for (const unit of info.units) {
        let forced = ctx.full;
        for (let i = 0; i < list.length && forced !== 0; i++) {
          const combo = list[i];
          let mask = 0;
          for (let p = 0; p < unit.positions.length; p++) {
            mask |= 1 << (combo[unit.positions[p]] - 1);
          }
          forced &= mask;
        }
        if (forced === 0) continue;
        const members = units[unit.key];
        for (let i = 0; i < members.length; i++) {
          const cell = members[i];
          if (cageOfCell[cell] === ci) continue;
          if ((cands[cell] & forced) !== 0) {
            const next = cands[cell] & ~forced;
            if (next === 0) return -1;
            stats.eliminations += popcount(cands[cell]) - popcount(next);
            cands[cell] = next;
            touch(cell);
            changed = true;
          }
        }
      }
    }

    // (D2) unit -> cage: if every cell in a unit that could hold digit v lives
    //      in one cage, that cage must place v inside this unit.
    for (let u = 0; u < units.length; u++) {
      const members = units[u];
      const unitKey = u;
      for (let v = 1; v <= size; v++) {
        const bit = 1 << (v - 1);
        let owner = -2;
        for (let i = 0; i < members.length; i++) {
          if ((cands[members[i]] & bit) === 0) continue;
          const ci = cageOfCell[members[i]];
          if (owner === -2) owner = ci;
          else if (owner !== ci) {
            owner = -1;
            break;
          }
        }
        if (owner < 0) continue;
        const list = st.combos[owner];
        if (list.length > DEEP_RULE_COMBO_LIMIT) continue;
        const unit = cages[owner].units.find((x) => x.key === unitKey);
        if (!unit) continue;
        let kept: number[][] | null = null;
        for (let i = 0; i < list.length; i++) {
          const combo = list[i];
          let has = false;
          for (let p = 0; p < unit.positions.length; p++) {
            if (combo[unit.positions[p]] === v) {
              has = true;
              break;
            }
          }
          if (has) {
            if (kept !== null) kept.push(combo);
          } else if (kept === null) {
            kept = list.slice(0, i);
          }
        }
        if (kept !== null) {
          if (kept.length === 0) return -1;
          st.combos[owner] = kept;
          stale[owner] = 1;
          changed = true;
        }
      }
    }

    return changed ? 1 : 0;
  };

  // Cheap rules to a fixpoint, then one expensive pass; repeat until neither
  // tier finds anything new.
  for (;;) {
    const shallowResult = shallow();
    if (shallowResult === -1) return false;
    if (shallowResult === 1) continue;
    const deepResult = deep();
    if (deepResult === -1) return false;
    if (deepResult === 0) break;
  }

  return true;
}

function assemble(ctx: Context, st: State): number[] | null {
  const grid = new Array<number>(ctx.cellCount).fill(0);
  for (let ci = 0; ci < ctx.cages.length; ci++) {
    const list = st.combos[ci];
    if (list.length !== 1) return null;
    const combo = list[0];
    const cells = ctx.cages[ci].cells;
    for (let k = 0; k < cells.length; k++) grid[cells[k]] = combo[k];
  }
  // Final safety check: a genuine Latin square.
  const size = ctx.size;
  const rowSeen = new Array<number>(size).fill(0);
  const colSeen = new Array<number>(size).fill(0);
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v < 1 || v > size) return null;
    const bit = 1 << (v - 1);
    const r = (i / size) | 0;
    const c = i % size;
    if ((rowSeen[r] & bit) !== 0 || (colSeen[c] & bit) !== 0) return null;
    rowSeen[r] |= bit;
    colSeen[c] |= bit;
  }
  return grid;
}

function cloneState(st: State): State {
  return { cands: st.cands.slice(), combos: st.combos.slice() };
}

function search(
  ctx: Context,
  st: State,
  limit: number,
  out: number[][],
  depth: number,
  alreadyPropagated: boolean,
): void {
  if (ctx.aborted) return;
  if (depth > ctx.stats.maxDepth) ctx.stats.maxDepth = depth;
  if (!alreadyPropagated && !propagate(ctx, st)) return;

  let best = -1;
  let bestCount = Infinity;
  for (let ci = 0; ci < ctx.cages.length; ci++) {
    const count = st.combos[ci].length;
    if (count > 1 && count < bestCount) {
      bestCount = count;
      best = ci;
    }
  }

  if (best === -1) {
    const grid = assemble(ctx, st);
    if (grid) out.push(grid);
    return;
  }

  ctx.stats.nodes++;
  const options = st.combos[best];
  for (let i = 0; i < options.length; i++) {
    if (out.length >= limit) return;
    ctx.stats.guesses++;
    if (ctx.stats.guesses > ctx.nodeLimit) {
      ctx.aborted = true;
      return;
    }
    const child = cloneState(st);
    child.combos[best] = [options[i]];
    search(ctx, child, limit, out, depth + 1, false);
    if (ctx.aborted) return;
  }
}

/** Solve a puzzle's cage constraints. Ignores `puzzle.solution` entirely. */
export function solve(puzzle: Puzzle, options: SolveOptions = {}): SolveResult {
  const limit = Math.max(1, options.limit ?? 1);
  const maxCombos = options.maxCombosPerCage ?? DEFAULT_MAX_COMBOS_PER_CAGE;
  const nodeLimit = options.nodeLimit ?? DEFAULT_NODE_LIMIT;

  const { ctx, state } = buildContext(puzzle, maxCombos, nodeLimit);
  if (!state) {
    return { solutions: [], stats: ctx.stats, aborted: true, infeasible: false };
  }

  // Every cell must belong to a cage for the puzzle to be well formed.
  for (let i = 0; i < ctx.cellCount; i++) {
    if (ctx.cageOfCell[i] === -1) {
      return { solutions: [], stats: ctx.stats, aborted: false, infeasible: true };
    }
  }

  // One propagation pass up front so the stats describe the puzzle's
  // "logic only" difficulty before any guessing happens.
  const root = cloneState(state);
  const feasible = propagate(ctx, root);
  if (!feasible) {
    return { solutions: [], stats: ctx.stats, aborted: false, infeasible: true };
  }
  let solvedCells = 0;
  for (let i = 0; i < ctx.cellCount; i++) {
    const m = root.cands[i];
    if (m !== 0 && (m & (m - 1)) === 0) solvedCells++;
  }
  ctx.stats.solvedByPropagation = solvedCells;
  ctx.stats.combosAfterPropagation = root.combos.reduce((acc, l) => acc + l.length, 0);

  const out: number[][] = [];
  search(ctx, root, limit, out, 0, true);

  return {
    solutions: out,
    stats: ctx.stats,
    aborted: ctx.aborted,
    infeasible: !ctx.aborted && out.length === 0,
  };
}
