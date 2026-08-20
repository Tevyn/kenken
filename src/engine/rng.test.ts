import { describe, expect, it } from 'vitest';
import { hashSeed, makeRng, randomSeed } from './rng';

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng('hello');
    const b = makeRng('hello');
    const left = Array.from({ length: 50 }, () => a.next());
    const right = Array.from({ length: 50 }, () => b.next());
    expect(left).toEqual(right);
  });

  it('produces different streams for different seeds', () => {
    const a = Array.from({ length: 20 }, (_unused, i) => makeRng(`seed-${i}`).next());
    expect(new Set(a).size).toBe(a.length);
  });

  it('decorrelates seeds that differ by one character', () => {
    const a = makeRng('seed-1').next();
    const b = makeRng('seed-2').next();
    expect(Math.abs(a - b)).toBeGreaterThan(0.001);
  });

  it('emits floats in [0, 1)', () => {
    const rng = makeRng('range');
    for (let i = 0; i < 5000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('spreads values across the unit interval', () => {
    const rng = makeRng('spread');
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 10000; i++) buckets[Math.floor(rng.next() * 10)]++;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(700);
      expect(count).toBeLessThan(1300);
    }
  });
});

describe('nextInt', () => {
  it('stays inside [0, bound)', () => {
    const rng = makeRng('ints');
    for (const bound of [1, 2, 3, 7, 81]) {
      for (let i = 0; i < 500; i++) {
        const value = rng.nextInt(bound);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(bound);
      }
    }
  });

  it('hits every value of a small range', () => {
    const rng = makeRng('coverage');
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(rng.nextInt(4));
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });

  it('rejects a bound below 1', () => {
    const rng = makeRng('bad');
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-3)).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  it('permutes without losing or duplicating elements', () => {
    const rng = makeRng('shuffle');
    for (let trial = 0; trial < 50; trial++) {
      const items = Array.from({ length: 12 }, (_unused, i) => i);
      const result = rng.shuffle(items.slice());
      expect(result.slice().sort((a, b) => a - b)).toEqual(items);
    }
  });

  it('actually reorders (not the identity every time)', () => {
    const rng = makeRng('reorder');
    let moved = 0;
    for (let trial = 0; trial < 20; trial++) {
      const items = [0, 1, 2, 3, 4, 5, 6, 7];
      const shuffled = rng.shuffle(items.slice());
      if (shuffled.join() !== items.join()) moved++;
    }
    expect(moved).toBeGreaterThan(15);
  });

  it('returns the same array instance', () => {
    const rng = makeRng('inplace');
    const items = [1, 2, 3];
    expect(rng.shuffle(items)).toBe(items);
  });
});

describe('pick and weightedPick', () => {
  it('picks only from the given items', () => {
    const rng = makeRng('pick');
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 200; i++) expect(items).toContain(rng.pick(items));
  });

  it('throws when picking from nothing', () => {
    const rng = makeRng('empty');
    expect(() => rng.pick([])).toThrow(RangeError);
    expect(() => rng.weightedPick([], [])).toThrow(RangeError);
  });

  it('respects the weights', () => {
    const rng = makeRng('weights');
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 6000; i++) {
      counts[rng.weightedPick(['a', 'b', 'c'] as const, [8, 2, 0])]++;
    }
    expect(counts.c).toBe(0);
    expect(counts.a).toBeGreaterThan(counts.b * 2);
    expect(counts.b).toBeGreaterThan(500);
  });

  it('falls back to a uniform pick when all weights are zero', () => {
    const rng = makeRng('zero-weights');
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(rng.weightedPick(['a', 'b'], [0, 0]));
    expect(seen.size).toBe(2);
  });

  it('never returns an item whose weight is zero', () => {
    const rng = makeRng('skip-zero');
    for (let i = 0; i < 500; i++) {
      expect(rng.weightedPick(['keep', 'drop'], [1, 0])).toBe('keep');
    }
  });
});

describe('fork', () => {
  it('derives an independent but reproducible stream', () => {
    const parentA = makeRng('parent');
    const parentB = makeRng('parent');
    const a = parentA.fork('child').next();
    const b = parentB.fork('child').next();
    expect(a).toBe(b);
    expect(makeRng('parent').fork('other').next()).not.toBe(a);
  });
});

describe('hashSeed', () => {
  it('returns a stable unsigned 32-bit value', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).toBeGreaterThanOrEqual(0);
    expect(hashSeed('abc')).toBeLessThan(2 ** 32);
  });

  it('separates similar inputs', () => {
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
    expect(hashSeed('')).not.toBe(hashSeed(' '));
  });
});

describe('randomSeed', () => {
  it('produces distinct, typable seeds', () => {
    const seeds = new Set(Array.from({ length: 200 }, () => randomSeed()));
    expect(seeds.size).toBeGreaterThan(190);
    for (const seed of seeds) expect(seed).toMatch(/^[a-z2-9]{10}$/);
  });

  it('honours a custom length', () => {
    expect(randomSeed(4)).toHaveLength(4);
  });
});
