import type { Mode } from '../game/state'
import './Keypad.css'

export interface KeypadProps {
  size: number
  mode: Mode
  onDigit: (value: number) => void
  onErase: () => void
  onToggleMode: () => void
}

/** On-screen digit pad so the game is fully playable by touch. */
export function Keypad({ size, mode, onDigit, onErase, onToggleMode }: KeypadProps) {
  const digits = Array.from({ length: size }, (_, i) => i + 1)

  return (
    <div className="kk-keypad">
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
      <div className="kk-keypad__actions">
        <button type="button" className="kk-keypad__action" onClick={onErase}>
          Erase
        </button>
        <button
          type="button"
          className="kk-keypad__action kk-keypad__action--mode"
          onClick={onToggleMode}
          aria-pressed={mode === 'mark'}
        >
          {mode === 'mark' ? 'Marks: On' : 'Marks: Off'}
        </button>
      </div>
    </div>
  )
}
