import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Puzzle } from '../engine/types';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import { loadSession, saveSession } from './session';
import type { SavedSession } from './session';

const SESSION_KEY = 'kenken:session';

/** A saved game built on the sample fixture: one value placed, one pencil mark. */
function sampleSession(): SavedSession {
  const cells = SAMPLE_PUZZLE.size * SAMPLE_PUZZLE.size;
  const values = new Array<number | null>(cells).fill(null);
  values[0] = 1;
  const marks = Array.from({ length: cells }, () => [] as number[]);
  marks[1] = [2, 3];
  return { puzzle: SAMPLE_PUZZLE, values, marks };
}

describe('session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(loadSession()).toBeNull();
  });

  it('round-trips a saved game through save/load', () => {
    const session = sampleSession();
    saveSession(session);

    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.values[0]).toBe(1);
    expect(loaded?.marks[1]).toEqual([2, 3]);
    expect(loaded?.puzzle.size).toBe(SAMPLE_PUZZLE.size);
  });

  it('returns null when the stored JSON is malformed', () => {
    localStorage.setItem(SESSION_KEY, '{ not json');
    expect(loadSession()).toBeNull();
  });

  it('returns null when the puzzle shape is unusable', () => {
    // A size outside the supported range: nothing downstream could draw it.
    const badPuzzle = { ...SAMPLE_PUZZLE, size: 99 } as Puzzle;
    const cells = SAMPLE_PUZZLE.size * SAMPLE_PUZZLE.size;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        puzzle: badPuzzle,
        values: new Array(cells).fill(null),
        marks: Array.from({ length: cells }, () => []),
      }),
    );
    expect(loadSession()).toBeNull();
  });

  it('returns null when the solution length disagrees with the size', () => {
    const badPuzzle = { ...SAMPLE_PUZZLE, solution: [1, 2, 3] } as Puzzle;
    const cells = SAMPLE_PUZZLE.size * SAMPLE_PUZZLE.size;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        puzzle: badPuzzle,
        values: new Array(cells).fill(null),
        marks: Array.from({ length: cells }, () => []),
      }),
    );
    expect(loadSession()).toBeNull();
  });

  it('returns null when the board arrays are the wrong length', () => {
    const session = sampleSession();
    // A values array that no longer matches the grid — a stale save from a
    // differently-sized puzzle, say — must be rejected, not half-restored.
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, values: [1, 2] }));
    expect(loadSession()).toBeNull();
  });

  describe('with a throwing storage', () => {
    const originalLocalStorage = globalThis.localStorage;

    beforeEach(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem() {
            throw new Error('storage disabled');
          },
          setItem() {
            throw new Error('storage disabled');
          },
        },
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    });

    it('load returns null instead of throwing', () => {
      expect(() => loadSession()).not.toThrow();
      expect(loadSession()).toBeNull();
    });

    it('save swallows the error instead of throwing', () => {
      expect(() => saveSession(sampleSession())).not.toThrow();
    });
  });
});
