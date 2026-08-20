/**
 * Cage construction: partition the grid into orthogonally-connected cages by
 * randomized accretion, then give every cage a legal operator and target
 * derived from the solution values.
 */

import type { Cage, CellIndex, Op } from './types';
import type { Rng } from './rng';
import type { DifficultyParams } from './difficulty';

/** Orthogonal neighbours of a flat cell index. */
export function neighborsOf(cell: CellIndex, size: number): CellIndex[] {
  const row = (cell / size) | 0;
  const col = cell % size;
  const out: CellIndex[] = [];
  if (row > 0) out.push(cell - size);
  if (row < size - 1) out.push(cell + size);
  if (col > 0) out.push(cell - 1);
  if (col < size - 1) out.push(cell + 1);
  return out;
}

/** True when every cell in `cells` is reachable from the first by orthogonal steps. */
export function isConnected(cells: readonly CellIndex[], size: number): boolean {
  if (cells.length <= 1) return true;
  const members = new Set(cells);
  const seen = new Set<CellIndex>([cells[0]]);
  const stack = [cells[0]];
  while (stack.length > 0) {
    const cell = stack.pop() as CellIndex;
    for (const nb of neighborsOf(cell, size)) {
      if (members.has(nb) && !seen.has(nb)) {
        seen.add(nb);
        stack.push(nb);
      }
    }
  }
  return seen.size === cells.length;
}

/**
 * Partition `size * size` cells into connected cages.
 *
 * Guarantees (or throws after exhausting its attempts):
 *  - every cell appears in exactly one cage,
 *  - every cage is orthogonally connected,
 *  - no cage exceeds `params.maxCageSize`,
 *  - the number of single-cell cages lies in
 *    `[params.minFreebies, params.maxFreebies]`.
 */
export function partitionCages(
  size: number,
  rng: Rng,
  params: DifficultyParams,
  maxAttempts = 60,
): CellIndex[][] {
  const cells = size * size;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = attemptPartition(size, rng, params);
    if (!result) continue;

    const singles = result.filter((c) => c.length === 1).length;
    if (singles < params.minFreebies || singles > params.maxFreebies) continue;
    if (result.some((c) => c.length > params.maxCageSize)) continue;
    if (result.reduce((acc, c) => acc + c.length, 0) !== cells) continue;

    result.forEach((c) => c.sort((a, b) => a - b));
    result.sort((a, b) => a[0] - b[0]);
    return result;
  }

  throw new Error(
    `Could not partition a ${size}x${size} grid within the freebie band ` +
      `[${params.minFreebies}, ${params.maxFreebies}] and cage cap ${params.maxCageSize}`,
  );
}

function attemptPartition(
  size: number,
  rng: Rng,
  params: DifficultyParams,
): CellIndex[][] | null {
  const cellCount = size * size;
  const owner = new Int32Array(cellCount).fill(-1);
  const cages: CellIndex[][] = [];
  const planned = new Set<number>();

  // 1. Place the planned freebies first, spread out where possible.
  const freebieTarget =
    params.minFreebies + rng.nextInt(params.maxFreebies - params.minFreebies + 1);
  if (freebieTarget > 0) {
    const order = rng.shuffle(range(cellCount));
    const chosen: number[] = [];
    for (const cell of order) {
      if (chosen.length >= freebieTarget) break;
      if (neighborsOf(cell, size).some((nb) => owner[nb] !== -1)) continue;
      owner[cell] = cages.length;
      planned.add(cages.length);
      cages.push([cell]);
      chosen.push(cell);
    }
    // If the "no adjacent freebies" preference starved us, relax it.
    for (const cell of order) {
      if (chosen.length >= freebieTarget) break;
      if (owner[cell] !== -1) continue;
      owner[cell] = cages.length;
      planned.add(cages.length);
      cages.push([cell]);
      chosen.push(cell);
    }
    if (chosen.length < freebieTarget) return null;
  }

  // 2. Accretion. Always seed from the most hemmed-in free cell so that we do
  //    not strand isolated leftovers.
  const sizeOptions: number[] = [];
  const sizeWeights: number[] = [];
  for (let s = 2; s <= params.maxCageSize; s++) {
    sizeOptions.push(s);
    sizeWeights.push(params.cageSizeWeights[s] ?? 0);
  }
  if (sizeOptions.length === 0) return null;

  let remaining = cellCount - cages.length;
  while (remaining > 0) {
    const seed = pickSeedCell(owner, size, rng);
    if (seed === -1) break;

    const wanted = rng.weightedPick(sizeOptions, sizeWeights);
    const cageIndex = cages.length;
    const cage: CellIndex[] = [seed];
    owner[seed] = cageIndex;
    remaining--;

    const frontier: CellIndex[] = neighborsOf(seed, size).filter((nb) => owner[nb] === -1);
    while (cage.length < wanted && frontier.length > 0) {
      const at = rng.nextInt(frontier.length);
      const next = frontier[at];
      frontier.splice(at, 1);
      if (owner[next] !== -1) continue;
      owner[next] = cageIndex;
      cage.push(next);
      remaining--;
      for (const nb of neighborsOf(next, size)) {
        if (owner[nb] === -1) frontier.push(nb);
      }
    }
    cages.push(cage);
  }

  if (remaining !== 0) return null;

  // 3. Fold away any accidental single-cell cages beyond the freebie budget.
  const strays = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < cages.length; i++) {
      if (cages[i].length === 1 && !planned.has(i)) out.push(i);
    }
    return out;
  };

  let singles = cages.filter((c) => c.length === 1).length;
  if (singles > params.maxFreebies) {
    for (const idx of strays()) {
      if (singles <= params.maxFreebies) break;
      if (absorbSingleton(cages, owner, idx, size, params.maxCageSize, rng)) singles--;
      else return null;
    }
  }
  if (singles > params.maxFreebies) return null;

  return cages.filter((c) => c.length > 0);
}

/** The unassigned cell with the fewest unassigned neighbours (random tiebreak). */
function pickSeedCell(owner: Int32Array, size: number, rng: Rng): number {
  let best = -1;
  let bestDegree = Infinity;
  let ties = 0;
  for (let cell = 0; cell < owner.length; cell++) {
    if (owner[cell] !== -1) continue;
    let degree = 0;
    for (const nb of neighborsOf(cell, size)) {
      if (owner[nb] === -1) degree++;
    }
    if (degree < bestDegree) {
      bestDegree = degree;
      best = cell;
      ties = 1;
    } else if (degree === bestDegree) {
      ties++;
      // Reservoir sampling keeps the choice uniform among equally-hemmed cells.
      if (rng.nextInt(ties) === 0) best = cell;
    }
  }
  return best;
}

/**
 * Merge a lone cell into a neighbouring cage; if every neighbour is already at
 * the size cap, steal an adjacent cell from one of them instead (only when the
 * donor stays connected). Returns false when neither is possible.
 */
function absorbSingleton(
  cages: CellIndex[][],
  owner: Int32Array,
  index: number,
  size: number,
  maxCageSize: number,
  rng: Rng,
): boolean {
  const cell = cages[index][0];
  const nbs = rng.shuffle(neighborsOf(cell, size));

  for (const nb of nbs) {
    const target = owner[nb];
    if (target === index || target === -1) continue;
    if (cages[target].length < maxCageSize) {
      cages[target].push(cell);
      owner[cell] = target;
      cages[index] = [];
      return true;
    }
  }

  for (const nb of nbs) {
    const donor = owner[nb];
    if (donor === index || donor === -1) continue;
    const rest = cages[donor].filter((c) => c !== nb);
    if (rest.length === 0 || !isConnected(rest, size)) continue;
    cages[donor] = rest;
    cages[index] = [cell, nb];
    owner[nb] = index;
    return true;
  }

  return false;
}

/**
 * Give each cage an operator and target consistent with the solution.
 *
 * `'-'` and `'/'` are only offered for 2-cell cages (a 2-cell cage is always a
 * domino, so its two solution values necessarily differ), and `'/'` only when
 * the larger value is an exact multiple of the smaller.
 */
export function assignCageOps(
  partition: readonly CellIndex[][],
  solution: readonly number[],
  rng: Rng,
  params: DifficultyParams,
): Cage[] {
  return partition.map((cells, id) => {
    const values = cells.map((c) => solution[c]);
    const choices = legalOps(values, params.allowedOps);
    if (choices.length === 0) {
      throw new Error(`No legal operator for cage ${JSON.stringify(cells)}`);
    }
    const weights = choices.map((c) => params.opWeights[c.op] ?? 1);
    const chosen = rng.weightedPick(choices, weights);
    return { id, cells: cells.slice(), op: chosen.op, target: chosen.target };
  });
}

/**
 * Does a fully-filled cage's arithmetic work out?
 * See `docs/ENGINE_API.md` ("Semantics of cage arithmetic") for the rules.
 */
export function cageSatisfied(cage: Cage, values: readonly number[]): boolean {
  if (values.length !== cage.cells.length) return false;
  switch (cage.op) {
    case '=':
      return values.length === 1 && values[0] === cage.target;
    case '+':
      return values.reduce((a, b) => a + b, 0) === cage.target;
    case '*':
      return values.reduce((a, b) => a * b, 1) === cage.target;
    case '-': {
      if (values.length !== 2) return false;
      return Math.abs(values[0] - values[1]) === cage.target;
    }
    case '/': {
      if (values.length !== 2) return false;
      const hi = Math.max(values[0], values[1]);
      const lo = Math.min(values[0], values[1]);
      return lo > 0 && hi % lo === 0 && hi / lo === cage.target;
    }
    default:
      return false;
  }
}

/** Every operator/target pair that the given cage values satisfy. */
export function legalOps(
  values: readonly number[],
  allowed: readonly Op[],
): { op: Op; target: number }[] {
  if (values.length === 1) return [{ op: '=', target: values[0] }];

  const out: { op: Op; target: number }[] = [];
  const sum = values.reduce((a, b) => a + b, 0);
  const product = values.reduce((a, b) => a * b, 1);

  if (allowed.includes('+')) out.push({ op: '+', target: sum });
  if (allowed.includes('*')) out.push({ op: '*', target: product });

  if (values.length === 2) {
    const hi = Math.max(values[0], values[1]);
    const lo = Math.min(values[0], values[1]);
    if (allowed.includes('-') && hi - lo > 0) out.push({ op: '-', target: hi - lo });
    if (allowed.includes('/') && lo > 0 && hi % lo === 0 && hi / lo > 1) {
      out.push({ op: '/', target: hi / lo });
    }
  }

  return out;
}

function range(n: number): number[] {
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = i;
  return out;
}
