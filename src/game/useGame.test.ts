import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import { useGame } from './useGame';

function pressKey(key: string, init: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
}

/** A press that starts on the document, the way the clearing listener sees one. */
function pressMouse() {
  act(() => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
}

describe('useGame keyboard handling', () => {
  it('selects, types a digit, moves, erases', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));

    act(() => result.current.select(0));
    pressKey('1');
    expect(result.current.state.values[0]).toBe(1);

    pressKey('ArrowRight');
    expect(result.current.state.selected).toBe(1);

    pressKey('2');
    expect(result.current.state.values[1]).toBe(2);

    pressKey('Backspace');
    expect(result.current.state.values[1]).toBeNull();
  });

  it('digits beyond the puzzle size are ignored', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    act(() => result.current.select(0));
    pressKey('9');
    expect(result.current.state.values[0]).toBeNull();
  });

  it('space toggles mode', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    expect(result.current.state.mode).toBe('value');
    pressKey(' ');
    expect(result.current.state.mode).toBe('mark');
    pressKey(' ');
    expect(result.current.state.mode).toBe('value');
  });

  it('Ctrl+Z undoes and Ctrl+Shift+Z redoes', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    act(() => result.current.select(0));
    pressKey('1');
    expect(result.current.state.values[0]).toBe(1);

    pressKey('z', { ctrlKey: true });
    expect(result.current.state.values[0]).toBeNull();

    pressKey('z', { ctrlKey: true, shiftKey: true });
    expect(result.current.state.values[0]).toBe(1);
  });

  it('Ctrl+Y also redoes', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    act(() => result.current.select(0));
    pressKey('1');
    pressKey('z', { ctrlKey: true });
    expect(result.current.state.values[0]).toBeNull();
    pressKey('y', { ctrlKey: true });
    expect(result.current.state.values[0]).toBe(1);
  });

  it('ignores keystrokes while a text input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    act(() => result.current.select(0));
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    });
    expect(result.current.state.values[0]).toBeNull();

    document.body.removeChild(input);
  });

  it('exposes canUndo/canRedo derived flags', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.select(0));
    act(() => result.current.enterDigit(1));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });
});

describe('useGame auto-clear preference', () => {
  it('defaults to on and flips with setAutoClearMarks', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    expect(result.current.state.autoClearMarks).toBe(true);

    act(() => result.current.setAutoClearMarks(false));
    expect(result.current.state.autoClearMarks).toBe(false);

    act(() => result.current.setAutoClearMarks(true));
    expect(result.current.state.autoClearMarks).toBe(true);
  });

  it('honours the initial value the caller supplies', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE, { autoClearMarks: false }));
    expect(result.current.state.autoClearMarks).toBe(false);

    // With it off, entering a 3 next door leaves the pencilled 3 in place.
    act(() => result.current.select(0));
    act(() => result.current.setMode('mark'));
    act(() => result.current.enterDigit(3));
    act(() => result.current.setMode('value'));
    act(() => result.current.select(1));
    act(() => result.current.enterDigit(3));
    expect(result.current.state.marks[0]).toEqual([3]);
  });
});

/*
 * H no longer does anything to the game: it opens a panel the game does not
 * own, so all it can do is say so.
 */
describe('useGame and the H shortcut', () => {
  it('forwards H to the owner without touching the board', () => {
    const onRequestHint = vi.fn();
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE, { onRequestHint }));

    pressKey('h');
    expect(onRequestHint).toHaveBeenCalledTimes(1);
    expect(result.current.state.hint).toEqual({ kind: 'idle' });
    expect(result.current.state.values.every((v) => v === null)).toBe(true);
  });

  it('Ctrl+H is left to the browser', () => {
    const onRequestHint = vi.fn();
    renderHook(() => useGame(SAMPLE_PUZZLE, { onRequestHint }));
    pressKey('h', { ctrlKey: true });
    expect(onRequestHint).not.toHaveBeenCalled();
  });

  it('ignores H while a text input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const onRequestHint = vi.fn();
    renderHook(() => useGame(SAMPLE_PUZZLE, { onRequestHint }));
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    });
    expect(onRequestHint).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  // The panel that H opens sets `suspended`, so the key must not reopen or
  // re-trigger anything while one is already up.
  it('stands down while a panel is open', () => {
    const onRequestHint = vi.fn();
    renderHook(() => useGame(SAMPLE_PUZZLE, { onRequestHint, suspended: true }));
    pressKey('h');
    expect(onRequestHint).not.toHaveBeenCalled();
  });
});

describe('useGame hints', () => {
  it('showHint explains a step without writing it', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));

    act(() => result.current.showHint());
    expect(result.current.state.hint.kind).toBe('shown');
    expect(result.current.state.values[14]).toBeNull();
    expect(result.current.highlight?.focus).toEqual([14]);
  });

  it('biases the hint toward the selected cell', () => {
    function focusAfterSelecting(cell: number): number[] {
      const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
      // Take the single rank-10 freebie off the board first, so several
      // equally-ranked cage hints are left and proximity is what decides.
      act(() => result.current.placeNumber());
      act(() => result.current.select(cell));
      act(() => result.current.showHint());
      const phase = result.current.state.hint;
      return phase.kind === 'shown' ? phase.hint.highlight.focus : [];
    }

    expect(focusAfterSelecting(0)).toContain(0);
    expect(focusAfterSelecting(15)).toContain(15);
  });

  it('placeNumber writes one digit, in one undo step', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));

    let wrote = false;
    act(() => {
      wrote = result.current.placeNumber();
    });
    expect(wrote).toBe(true);
    expect(result.current.state.values[14]).toBe(2);
    expect(result.current.state.placed).toEqual([14]);
    // An ordinary entry, however it got there.
    act(() => result.current.undo());
    expect(result.current.state.values[14]).toBeNull();
  });

  /*
   * The ladder walks past elimination-only steps to reach a placement, so the
   * number it writes need not be the one the Tip would have explained.
   */
  it('placeNumber reaches a number even when the easiest step is an elimination', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));

    // Clear the openings so the ladder has to work for the next placement.
    act(() => result.current.placeNumber());
    act(() => result.current.placeNumber());
    act(() => result.current.placeNumber());

    const filled = result.current.state.values.filter((v) => v !== null);
    expect(filled).toHaveLength(3);
    // Every one of them agrees with the solution: this is the engine's answer.
    for (let cell = 0; cell < 16; cell++) {
      const value = result.current.state.values[cell];
      if (value !== null) expect(value).toBe(SAMPLE_PUZZLE.solution[cell]);
    }
  });

  /*
   * A mistake on the board stalls the ladder, so it can reason out no next
   * number. The player is owed one anyway, so it comes straight from the
   * solution — a revealed cell, not the mistake explanation the ladder holds.
   */
  it('placeNumber reveals a solution digit when the ladder is stuck', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));

    // Cell 0 is 1 in the solution, and 2 is legal in its cage, so only the
    // solution-aware mistake check notices — nothing deducible follows.
    act(() => result.current.select(0));
    act(() => result.current.enterDigit(2));

    let wrote = false;
    act(() => {
      wrote = result.current.placeNumber();
    });
    expect(wrote).toBe(true);
    // The mistake stands; a fresh correct digit was revealed into an empty cell.
    expect(result.current.state.values[0]).toBe(2);
    expect(result.current.state.placed).toHaveLength(1);
    const revealed = result.current.state.placed[0];
    expect(result.current.state.values[revealed]).toBe(SAMPLE_PUZZLE.solution[revealed]);
  });
});

describe('useGame correctness check', () => {
  /** Cell 0 right, cell 1 wrong, then judged. */
  function judge(result: { current: ReturnType<typeof useGame> }) {
    act(() => result.current.select(0));
    act(() => result.current.enterDigit(SAMPLE_PUZZLE.solution[0] as number));
    act(() => result.current.select(1));
    act(() => result.current.enterDigit(SAMPLE_PUZZLE.solution[1] === 1 ? 2 : 1));
  }

  it('keeps only the wrong cells, and leaves the empty ones out of it', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    judge(result);
    act(() => result.current.checkBoard());

    expect(result.current.state.verdict).toEqual([1]);
  });

  it('reports how many were wrong, for the sentence the panel writes', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    judge(result);

    let wrong = -1;
    act(() => {
      wrong = result.current.checkBoard();
    });
    expect(wrong).toBe(1);
  });

  it('reports none wrong when every filled cell is right', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    act(() => result.current.select(0));
    act(() => result.current.enterDigit(SAMPLE_PUZZLE.solution[0] as number));

    let wrong = -1;
    act(() => {
      wrong = result.current.checkBoard();
    });
    expect(wrong).toBe(0);
    expect(result.current.state.verdict).toEqual([]);
  });

  /*
   * The verdict is not on the one-move clock a placed digit is: it belongs to
   * its cells and survives any number of presses elsewhere.
   */
  it('a mark stays until its own cell is edited', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));
    judge(result);
    act(() => result.current.checkBoard());

    pressMouse();
    pressMouse();
    pressKey('ArrowLeft');
    expect(result.current.state.verdict).toEqual([1]);

    act(() => result.current.select(1));
    act(() => result.current.erase());
    expect(result.current.state.verdict).toEqual([]);
  });

  it('a placed digit loses its ink on the next press', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE));

    act(() => result.current.placeNumber());
    expect(result.current.state.placed).toEqual([14]);

    pressKey('ArrowDown');
    expect(result.current.state.placed).toEqual([]);
    // The digit itself is untouched — only its ink was temporary.
    expect(result.current.state.values[14]).toBe(2);
  });
});
