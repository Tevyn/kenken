import type { CSSProperties } from 'react';
import type { Mode } from '../game/state';
import { HintMenu } from './HintMenu';
import type { HintMenuProps } from './HintMenu';
import { EraseIcon, MarksIcon, RedoIcon, UndoIcon } from './icons';
import './Keypad.css';

export interface KeypadProps {
  size: number;
  mode: Mode;
  onDigit: (value: number) => void;
  onErase: () => void;
  onToggleMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * Everything the hint popover needs, passed through untouched. Grouped
   * because it is one control's worth of wiring and the keypad only hosts it:
   * the panel reads the grid and writes to it, which is the owner's business
   * rather than the digit pad's.
   */
  hint: HintMenuProps;
}

/**
 * The action row plus the on-screen digit pad, so the game is fully playable
 * by touch.
 *
 * Every control here is bare blue ink on the page - no key, no border, no fill
 * (STYLE_GUIDE.md §4). That is what lets nine digits sit in one row on a 375px
 * phone: they are text, not boxes.
 *
 * The four actions carry a visible label under the glyph rather than relying
 * on an icon alone, and state is spelled out rather than tinted: Notes shows a
 * literal OFF/ON badge. Hint is the odd one out - it opens a panel rather than
 * doing anything itself, so it is a popover trigger wearing the same stack.
 *
 * Erase is not one of them. It lives on the digit row as its last key, because
 * that is where the hand already is while entering values - so the row holds
 * `size + 1` keys and still stays exactly one row (§1.3).
 */
export function Keypad({
  size,
  mode,
  onDigit,
  onErase,
  onToggleMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  hint,
}: KeypadProps) {
  const digits = Array.from({ length: size }, (_, i) => i + 1);

  return (
    <div className="kk-keypad">
      <div className="kk-keypad__actions" role="group" aria-label="Actions">
        <button
          type="button"
          className="kk-control kk-control--stack kk-keypad__action"
          onClick={onUndo}
          disabled={!canUndo}
          aria-keyshortcuts="Control+Z"
        >
          <UndoIcon size={22} />
          <span className="kk-control__label">Undo</span>
        </button>
        <button
          type="button"
          className="kk-control kk-control--stack kk-keypad__action"
          onClick={onRedo}
          disabled={!canRedo}
          aria-keyshortcuts="Control+Shift+Z Control+Y"
        >
          <RedoIcon size={22} />
          <span className="kk-control__label">Redo</span>
        </button>
        {/*
          The badge is the state, not a tint: it reads OFF or ON at all times,
          so the control says what it is doing without the player having to
          know what the default was. `aria-pressed` carries the same fact.
        */}
        <button
          type="button"
          className="kk-control kk-control--stack kk-keypad__action"
          onClick={onToggleMode}
          aria-pressed={mode === 'mark'}
          aria-keyshortcuts="Space"
        >
          <span className="kk-keypad__glyph">
            <MarksIcon size={22} />
            <span
              className={
                mode === 'mark' ? 'kk-keypad__badge kk-keypad__badge--on' : 'kk-keypad__badge'
              }
              aria-hidden="true"
            >
              {mode === 'mark' ? 'ON' : 'OFF'}
            </span>
          </span>
          <span className="kk-control__label">Notes</span>
        </button>
        <HintMenu {...hint} />
      </div>

      {/*
        `--keys` is the column count - `size` digits plus Erase - and it is
        injected from here rather than derived in CSS on purpose: the integer
        argument to `repeat()` does not accept `calc()` in every engine, so
        `repeat(calc(var(--size) + 1), ...)` is not safe to rely on. The count
        is known here, so the arithmetic happens here.
      */}
      <div
        className="kk-keypad__digits"
        role="group"
        aria-label="Digits"
        style={{ '--keys': size + 1 } as CSSProperties}
      >
        {digits.map((digit) => (
          <button
            key={digit}
            type="button"
            className="kk-control kk-keypad__digit"
            onClick={() => onDigit(digit)}
            aria-label={`Enter ${digit}`}
          >
            {digit}
          </button>
        ))}
        {/*
          A knowing exception to §4.2's "every icon action carries a visible
          text label". Erase is a digit-row key, and an eraser on a digit pad
          is a universally-read glyph - Sudoku.com and Good Sudoku both put a
          bare one there. A label under it would have to be matched by labels
          under the ten numerals or it would read as the odd key out, and
          either way it forces the whole row taller for one key. So it takes an
          `aria-label` instead, and keeps the shortcuts it already advertised.
        */}
        <button
          type="button"
          className="kk-control kk-keypad__digit kk-keypad__erase"
          onClick={onErase}
          aria-label="Erase"
          aria-keyshortcuts="Backspace Delete"
        >
          <EraseIcon />
        </button>
      </div>
    </div>
  );
}
