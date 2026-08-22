import type { CSSProperties } from 'react'
import type { Mode } from '../game/state'
import { EraseIcon, HintIcon, MarksIcon, RedoIcon, UndoIcon } from './icons'
import './Keypad.css'

export interface KeypadProps {
  size: number
  mode: Mode
  onDigit: (value: number) => void
  onErase: () => void
  onToggleMode: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  /** One press of the hint button: explain a step, or apply the one on screen. */
  onHint: () => void
  /** True once a hint is explained and the next press will apply it. */
  hintPending?: boolean
}

/**
 * The action row plus the on-screen digit pad, so the game is fully playable
 * by touch.
 *
 * Every control here is bare blue ink on the page - no key, no border, no fill
 * (STYLE_GUIDE.md §4). That is what lets nine digits sit in one row on a 375px
 * phone: they are text, not boxes.
 *
 * The five actions carry a visible label under the glyph rather than relying
 * on an icon alone, and state is spelled out rather than tinted: Notes shows a
 * literal OFF/ON badge, and Hint renames itself to "Apply" once a hint is on
 * the board waiting to be written in.
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
  onHint,
  hintPending = false,
}: KeypadProps) {
  const digits = Array.from({ length: size }, (_, i) => i + 1)

  return (
    <div className="kk-keypad">
      <div className="kk-keypad__actions" role="group" aria-label="Actions">
        <button
          type="button"
          className="kk-control kk-keypad__action"
          onClick={onUndo}
          disabled={!canUndo}
          aria-keyshortcuts="Control+Z"
        >
          <UndoIcon size={22} />
          <span className="kk-keypad__label">Undo</span>
        </button>
        <button
          type="button"
          className="kk-control kk-keypad__action"
          onClick={onRedo}
          disabled={!canRedo}
          aria-keyshortcuts="Control+Shift+Z Control+Y"
        >
          <RedoIcon size={22} />
          <span className="kk-keypad__label">Redo</span>
        </button>
        <button
          type="button"
          className="kk-control kk-keypad__action"
          onClick={onErase}
          aria-keyshortcuts="Backspace Delete"
        >
          <EraseIcon size={22} />
          <span className="kk-keypad__label">Erase</span>
        </button>
        {/*
          The badge is the state, not a tint: it reads OFF or ON at all times,
          so the control says what it is doing without the player having to
          know what the default was. `aria-pressed` carries the same fact.
        */}
        <button
          type="button"
          className="kk-control kk-keypad__action"
          onClick={onToggleMode}
          aria-pressed={mode === 'mark'}
          aria-keyshortcuts="Space"
        >
          <span className="kk-keypad__glyph">
            <MarksIcon size={22} />
            <span
              className={
                mode === 'mark'
                  ? 'kk-keypad__badge kk-keypad__badge--on'
                  : 'kk-keypad__badge'
              }
              aria-hidden="true"
            >
              {mode === 'mark' ? 'ON' : 'OFF'}
            </span>
          </span>
          <span className="kk-keypad__label">Notes</span>
        </button>
        {/*
          Not a toggle, so no OFF/ON badge would make sense here - "armed" is a
          transient state, and the label is the honest place to say it.
        */}
        <button
          type="button"
          className="kk-control kk-keypad__action"
          onClick={onHint}
          aria-keyshortcuts="H"
        >
          <HintIcon size={22} />
          <span className="kk-keypad__label">{hintPending ? 'Apply' : 'Hint'}</span>
        </button>
      </div>

      <div
        className="kk-keypad__digits"
        role="group"
        aria-label="Digits"
        style={{ '--size': size } as CSSProperties}
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
      </div>
    </div>
  )
}
