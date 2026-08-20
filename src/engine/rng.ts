/**
 * Small seeded PRNG used by every random decision in the engine.
 *
 * The engine must be reproducible from a seed string, so `Math.random()` is
 * called in exactly one place in the whole engine: `randomSeed()`, which mints a
 * fresh seed when the caller did not supply one.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, bound). Throws for bound < 1. */
  nextInt(bound: number): number;
  /** Fisher-Yates shuffle, in place; returns the same array. */
  shuffle<T>(items: T[]): T[];
  /** Uniformly pick one element. Throws for an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Pick an element with probability proportional to its weight. */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T;
  /** A derived, independent stream. Deterministic given this stream's state. */
  fork(label: string): Rng;
}

/**
 * cyrb128-style string hash producing a well-mixed 32-bit state.
 * Avoids the classic "similar seeds produce similar streams" problem.
 */
export function hashSeed(seed: string): number {
  let h1 = 1779033703 ^ seed.length;
  let h2 = 3144134277 ^ seed.length;
  let h3 = 1013904242 ^ seed.length;
  let h4 = 2773480762 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

/** mulberry32 — tiny, fast, good enough statistically for puzzle generation. */
export function makeRng(seed: string): Rng {
  let state = hashSeed(seed);
  // Guard against the degenerate all-zero state.
  if (state === 0) state = 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    nextInt(bound: number): number {
      if (!Number.isFinite(bound) || bound < 1) {
        throw new RangeError(`nextInt bound must be >= 1, got ${bound}`);
      }
      return Math.floor(next() * bound) % Math.floor(bound);
    },
    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = items[i];
        items[i] = items[j];
        items[j] = tmp;
      }
      return items;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('pick from empty array');
      return items[Math.floor(next() * items.length)];
    },
    weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
      if (items.length === 0) throw new RangeError('weightedPick from empty array');
      let total = 0;
      for (let i = 0; i < items.length; i++) {
        const w = weights[i];
        if (w > 0) total += w;
      }
      if (total <= 0) return rng.pick(items);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        const w = weights[i];
        if (w > 0) {
          r -= w;
          if (r < 0) return items[i];
        }
      }
      // Floating point fall-through: return the last positively weighted item.
      for (let i = items.length - 1; i >= 0; i--) {
        if (weights[i] > 0) return items[i];
      }
      return items[items.length - 1];
    },
    fork(label: string): Rng {
      return makeRng(`${label}#${state.toString(36)}#${rng.nextInt(0x7fffffff).toString(36)}`);
    },
  };

  return rng;
}

const SEED_ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';

/**
 * Mint a fresh, human-typable random seed string.
 * This is the ONLY place in the engine that touches `Math.random()`.
 */
export function randomSeed(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  }
  return out;
}
