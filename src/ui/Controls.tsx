import { useCallback } from 'react'
import type { Difficulty } from '../engine/types'
import { NewGameMenu } from './NewGameMenu'
import { SettingsMenu } from './SettingsMenu'
import './Controls.css'

/** Which popover, if any, is open. Only ever one at a time. */
export type OpenMenu = 'new-game' | 'settings' | null

export interface ControlsProps {
  /** The size currently being played; shown as the current choice in the wizard. */
  size: number
  /** The difficulty currently being played; shown as the current choice in the wizard. */
  difficulty: Difficulty
  /** Commit a new game. Both values arrive together, once the wizard finishes. */
  onStartGame: (size: number, difficulty: Difficulty) => void
  /** Whether entering a value also strips it from the row/column peers' pencil marks. */
  autoClearMarks: boolean
  onAutoClearMarksChange: (enabled: boolean) => void
  /**
   * The open popover, owned by the app rather than by this component: a popover
   * takes the keyboard away from the board while it is open, so whoever owns
   * the board's shortcuts has to know one is open.
   */
  openMenu: OpenMenu
  onOpenMenuChange: (menu: OpenMenu) => void
  /** True while a puzzle is generating; disables the control that would start another. */
  disabled?: boolean
}

/** The header's controls: the new-game wizard and the settings popover. */
export function Controls({
  size,
  difficulty,
  onStartGame,
  autoClearMarks,
  onAutoClearMarksChange,
  openMenu,
  onOpenMenuChange,
  disabled = false,
}: ControlsProps) {
  // A single slot rather than a flag each, so opening one closes the other.
  const handleNewGameOpenChange = useCallback(
    (open: boolean) => onOpenMenuChange(open ? 'new-game' : null),
    [onOpenMenuChange],
  )
  const handleSettingsOpenChange = useCallback(
    (open: boolean) => onOpenMenuChange(open ? 'settings' : null),
    [onOpenMenuChange],
  )

  const handleStartGame = useCallback(
    (nextSize: number, nextDifficulty: Difficulty) => {
      onOpenMenuChange(null)
      onStartGame(nextSize, nextDifficulty)
    },
    [onOpenMenuChange, onStartGame],
  )

  return (
    <div className="kk-controls">
      <NewGameMenu
        size={size}
        difficulty={difficulty}
        onStartGame={handleStartGame}
        open={openMenu === 'new-game'}
        onOpenChange={handleNewGameOpenChange}
        disabled={disabled}
      />
      <SettingsMenu
        autoClearMarks={autoClearMarks}
        onAutoClearMarksChange={onAutoClearMarksChange}
        open={openMenu === 'settings'}
        onOpenChange={handleSettingsOpenChange}
      />
    </div>
  )
}
