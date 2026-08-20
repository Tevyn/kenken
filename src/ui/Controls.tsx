import type { ChangeEvent } from 'react'
import type { Difficulty } from '../engine/types'
import { DIFFICULTIES, MAX_SIZE, MIN_SIZE } from '../engine/types'
import './Controls.css'

export interface ControlsProps {
  size: number
  difficulty: Difficulty
  onSizeChange: (size: number) => void
  onDifficultyChange: (difficulty: Difficulty) => void
  onNewPuzzle: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  /** True while a puzzle is generating; disables the controls that would trigger another. */
  disabled?: boolean
}

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i)

/** Grid-size / difficulty pickers, new-puzzle button, and undo/redo. */
export function Controls({
  size,
  difficulty,
  onSizeChange,
  onDifficultyChange,
  onNewPuzzle,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  disabled = false,
}: ControlsProps) {
  function handleSizeChange(event: ChangeEvent<HTMLSelectElement>) {
    onSizeChange(Number(event.target.value))
  }

  function handleDifficultyChange(event: ChangeEvent<HTMLSelectElement>) {
    onDifficultyChange(event.target.value as Difficulty)
  }

  return (
    <div className="kk-controls">
      <div className="kk-controls__field">
        <label htmlFor="kk-size-select">Size</label>
        <select id="kk-size-select" value={size} onChange={handleSizeChange} disabled={disabled}>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s} × {s}
            </option>
          ))}
        </select>
      </div>

      <div className="kk-controls__field">
        <label htmlFor="kk-difficulty-select">Difficulty</label>
        <select
          id="kk-difficulty-select"
          value={difficulty}
          onChange={handleDifficultyChange}
          disabled={disabled}
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d[0].toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="kk-controls__buttons">
        <button type="button" onClick={onNewPuzzle} disabled={disabled} className="kk-controls__primary">
          New puzzle
        </button>
        <button type="button" onClick={onUndo} disabled={disabled || !canUndo} aria-label="Undo">
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={disabled || !canRedo} aria-label="Redo">
          Redo
        </button>
      </div>
    </div>
  )
}
