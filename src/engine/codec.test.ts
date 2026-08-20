import { describe, expect, it } from 'vitest';
import { decodePuzzle, encodePuzzle } from './codec';
import { generatePuzzle } from './generator';
import { countSolutions } from './index';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import { DIFFICULTIES, MAX_SIZE, MIN_SIZE } from './types';
import type { Puzzle } from './types';

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_unused, i) => MIN_SIZE + i);

describe('encodePuzzle / decodePuzzle', () => {
  it.each(SIZES)('round-trips every tier of a %ix%i puzzle exactly', (size) => {
    for (const difficulty of DIFFICULTIES) {
      const puzzle = generatePuzzle({ size, difficulty, seed: `codec-${size}-${difficulty}` });
      const text = encodePuzzle(puzzle);
      expect(decodePuzzle(text)).toEqual(puzzle);
      // Re-encoding the decoded value must be byte-identical.
      expect(encodePuzzle(decodePuzzle(text))).toBe(text);
    }
  }, 120_000);

  it('round-trips the sample fixture', () => {
    expect(decodePuzzle(encodePuzzle(SAMPLE_PUZZLE))).toEqual(SAMPLE_PUZZLE);
  });

  it('keeps the decoded puzzle solvable and unique', () => {
    const puzzle = generatePuzzle({ size: 6, difficulty: 'hard', seed: 'codec-solvable' });
    expect(countSolutions(decodePuzzle(encodePuzzle(puzzle)), 2)).toBe(1);
  }, 60_000);

  it('survives seeds containing delimiters and unicode', () => {
    for (const seed of ['a|b;c.d:e%f', '', ' ', 'ünïcødé 🎲', '|||', '%7C']) {
      const puzzle: Puzzle = { ...SAMPLE_PUZZLE, seed };
      expect(decodePuzzle(encodePuzzle(puzzle)).seed).toBe(seed);
    }
  });

  it('stays compact', () => {
    const puzzle = generatePuzzle({ size: 9, difficulty: 'expert', seed: 'codec-size' });
    expect(encodePuzzle(puzzle).length).toBeLessThan(600);
  }, 60_000);

  it('produces a single line with no whitespace', () => {
    expect(encodePuzzle(SAMPLE_PUZZLE)).not.toMatch(/\s/);
  });

  it('tolerates surrounding whitespace when decoding', () => {
    const text = encodePuzzle(SAMPLE_PUZZLE);
    expect(decodePuzzle(`  ${text}\n`)).toEqual(SAMPLE_PUZZLE);
  });

  it('encodes cell indices above 35 correctly', () => {
    const puzzle = generatePuzzle({ size: 9, difficulty: 'medium', seed: 'codec-highcells' });
    const decoded = decodePuzzle(encodePuzzle(puzzle));
    const highest = Math.max(...decoded.cages.flatMap((c) => c.cells));
    expect(highest).toBeGreaterThan(35);
    expect(decoded.cages).toEqual(puzzle.cages);
  }, 60_000);
});

describe('decodePuzzle error handling', () => {
  it.each([
    ['not a puzzle at all', SyntaxError],
    ['KK1|4|e|s|1234', SyntaxError],
    ['KK9|4|e|s|1234123412341234|0.=1.00', SyntaxError],
    ['KK1|4|z|s|1234123412341234|0.=1.00', SyntaxError],
    ['KK1|4|e|s|123|0.=1.00', SyntaxError],
    ['KK1|4|e|s|1234123412341234|0.?1.00', SyntaxError],
    ['KK1|4|e|s|1234123412341234|0.=1.0', SyntaxError],
    ['KK1|4|e|s|1234123412341234|0.=1', SyntaxError],
  ])('rejects %s', (text, error) => {
    expect(() => decodePuzzle(text)).toThrow(error as ErrorConstructor);
  });

  it('rejects an out-of-range size', () => {
    expect(() => decodePuzzle('KK1|2|e|s|1234|0.=1.00')).toThrow(RangeError);
    expect(() => decodePuzzle('KK1|12|e|s|1234|0.=1.00')).toThrow(RangeError);
  });

  it('rejects a solution digit outside 1..size', () => {
    expect(() => decodePuzzle('KK1|3|e|s|123123129|0.=1.00')).toThrow(SyntaxError);
  });
});

describe('encodePuzzle error handling', () => {
  it('rejects a puzzle whose solution length disagrees with its size', () => {
    expect(() => encodePuzzle({ ...SAMPLE_PUZZLE, solution: [1, 2, 3] })).toThrow(RangeError);
  });

  it('rejects an unknown difficulty', () => {
    expect(() =>
      encodePuzzle({ ...SAMPLE_PUZZLE, difficulty: 'wat' as Puzzle['difficulty'] }),
    ).toThrow(RangeError);
  });

  it('rejects an out-of-range cell index', () => {
    expect(() =>
      encodePuzzle({
        ...SAMPLE_PUZZLE,
        cages: [{ id: 0, cells: [99999], op: '=', target: 1 }],
      }),
    ).toThrow(RangeError);
  });
});
