/**
 * Compact, exactly round-tripping puzzle serialization.
 *
 * Format (single line, no whitespace):
 *
 *   KK1|<size>|<difficulty>|<seed>|<solution>|<cage>;<cage>;...
 *
 *   difficulty : e | m | h | x
 *   seed       : percent-encoded, so it may contain any character
 *   solution   : one digit per cell, row-major (sizes are <= 9, so 1 char each)
 *   cage       : <id>.<op><target>.<cells>
 *   cells      : two base-36 characters per cell index, concatenated
 *
 * A 9x9 expert puzzle encodes to roughly 400 characters, which is short enough
 * for a URL fragment.
 */

import type { Cage, Difficulty, Op, Puzzle } from './types';
import { MAX_SIZE, MIN_SIZE } from './types';

const MAGIC = 'KK1';

const DIFFICULTY_CODES: Record<Difficulty, string> = {
  easy: 'e',
  medium: 'm',
  hard: 'h',
  expert: 'x',
};

const CODE_TO_DIFFICULTY: Record<string, Difficulty> = {
  e: 'easy',
  m: 'medium',
  h: 'hard',
  x: 'expert',
};

const OPS_SET = new Set<string>(['+', '-', '*', '/', '=']);

/** Serialize a puzzle to a compact string. */
export function encodePuzzle(puzzle: Puzzle): string {
  const code = DIFFICULTY_CODES[puzzle.difficulty];
  if (!code) throw new RangeError(`Cannot encode unknown difficulty: ${puzzle.difficulty}`);
  if (puzzle.solution.length !== puzzle.size * puzzle.size) {
    throw new RangeError('Puzzle solution length does not match its size');
  }

  const solution = puzzle.solution
    .map((v) => {
      if (!Number.isInteger(v) || v < 1 || v > 9) {
        throw new RangeError(`Cannot encode solution value ${v}`);
      }
      return String(v);
    })
    .join('');

  const cages = puzzle.cages
    .map((cage) => {
      const cells = cage.cells.map(encodeCell).join('');
      return `${cage.id.toString(36)}.${cage.op}${cage.target}.${cells}`;
    })
    .join(';');

  return [
    MAGIC,
    String(puzzle.size),
    code,
    encodeURIComponent(puzzle.seed),
    solution,
    cages,
  ].join('|');
}

/** Parse a string produced by `encodePuzzle`. Throws on malformed input. */
export function decodePuzzle(text: string): Puzzle {
  const parts = text.trim().split('|');
  if (parts.length !== 6 || parts[0] !== MAGIC) {
    throw new SyntaxError('Not a KenKen puzzle string');
  }

  const size = Number(parts[1]);
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(`Encoded size out of range: ${parts[1]}`);
  }

  const difficulty = CODE_TO_DIFFICULTY[parts[2]];
  if (!difficulty) throw new SyntaxError(`Unknown difficulty code: ${parts[2]}`);

  const seed = decodeURIComponent(parts[3]);

  const solutionText = parts[4];
  if (solutionText.length !== size * size) {
    throw new SyntaxError('Encoded solution has the wrong length');
  }
  const solution = Array.from(solutionText, (ch) => {
    const v = Number(ch);
    if (!Number.isInteger(v) || v < 1 || v > size) {
      throw new SyntaxError(`Bad solution digit: ${ch}`);
    }
    return v;
  });

  const cages: Cage[] = parts[5] === '' ? [] : parts[5].split(';').map(decodeCage);

  return { size, difficulty, cages, solution, seed };
}

function decodeCage(chunk: string): Cage {
  const fields = chunk.split('.');
  if (fields.length !== 3) throw new SyntaxError(`Bad cage chunk: ${chunk}`);

  const id = parseInt(fields[0], 36);
  if (!Number.isInteger(id) || id < 0) throw new SyntaxError(`Bad cage id: ${fields[0]}`);

  const op = fields[1].slice(0, 1);
  if (!OPS_SET.has(op)) throw new SyntaxError(`Bad cage operator: ${op}`);
  const target = Number(fields[1].slice(1));
  if (!Number.isInteger(target)) throw new SyntaxError(`Bad cage target: ${fields[1]}`);

  const cellsText = fields[2];
  if (cellsText.length === 0 || cellsText.length % 2 !== 0) {
    throw new SyntaxError(`Bad cage cell list: ${cellsText}`);
  }
  const cells: number[] = [];
  for (let i = 0; i < cellsText.length; i += 2) {
    const cell = parseInt(cellsText.slice(i, i + 2), 36);
    if (!Number.isInteger(cell) || cell < 0) {
      throw new SyntaxError(`Bad cell index in: ${cellsText}`);
    }
    cells.push(cell);
  }

  return { id, cells, op: op as Op, target };
}

function encodeCell(cell: number): string {
  if (!Number.isInteger(cell) || cell < 0 || cell > 1295) {
    throw new RangeError(`Cannot encode cell index ${cell}`);
  }
  return cell.toString(36).padStart(2, '0');
}
