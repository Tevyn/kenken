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
 * The five actions sit above the digits, where Sudoku apps put them, and are
 * icon-only: no visible label and no `title`, so nothing hovers. Each one
 * carries an `aria-label` instead, and the two stateful ones (hint, pencil
 * marks) say which state they are in through that label as well as their tint.
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
          className="kk-keypad__action"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          aria-keyshortcuts="Control+Z"
        >
          <UndoIcon size={22} />
        </button>
        <button
          type="button"
          className="kk-keypad__action"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          aria-keyshortcuts="Control+Shift+Z Control+Y"
        >
          <RedoIcon size={22} />
        </button>
        <button
          type="button"
          className="kk-keypad__action"
          onClick={onErase}
          aria-label="Erase"
          aria-keyshortcuts="Backspace Delete"
        >
          <EraseIcon size={22} />
        </button>
        <button
          type="button"
          className="kk-keypad__action kk-keypad__action--mode"
          onClick={onToggleMode}
          aria-pressed={mode === 'mark'}
          aria-label="Pencil-mark mode"
          aria-keyshortcuts="Space"
        >
          <MarksIcon size={22} />
        </button>
        {/*
          The lightbulb never changes, but the state does: "armed" means a hint
          is explained on the board and the next press writes it in.
        */}
        <button
          type="button"
          className={
            hintPending
              ? 'kk-keypad__action kk-keypad__action--hint kk-keypad__action--armed'
              : 'kk-keypad__action kk-keypad__action--hint'
          }
          onClick={onHint}
          aria-label={hintPending ? 'Apply hint' : 'Hint'}
          aria-keyshortcuts="H"
        >
          <HintIcon size={22} />
        </button>
      </div>

      <div className="kk-keypad__digits" role="group" aria-label="Digits">
        {digits.map((digit) => (
          <button
            key={digit}
            type="button"
            className="kk-keypad__digit"
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
