import { useCallback } from 'react';
import type { Difficulty } from '../engine/types';
import type { Theme } from '../game/preferences';
import { RestartIcon } from './icons';
import { NewGameMenu } from './NewGameMenu';
import type { OpenMenu } from './Popover';
import { SettingsMenu } from './SettingsMenu';
import './Controls.css';

export interface ControlsProps {
  /** The size currently being played; shown as the current choice in the wizard. */
  size: number;
  /** The difficulty currently being played; shown as the current choice in the wizard. */
  difficulty: Difficulty;
  /** Commit a new game. Both values arrive together, once the wizard finishes. */
  onStartGame: (size: number, difficulty: Difficulty) => void;
  /** Empty the board, keeping the puzzle. Undoable, so it asks nothing first. */
  onRestart: () => void;
  /** False when the board is already empty and restarting would do nothing. */
  canRestart: boolean;
  /** Whether entering a value also strips it from the row/column peers' pencil marks. */
  autoClearMarks: boolean;
  onAutoClearMarksChange: (enabled: boolean) => void;
  /** Which palette to paint, or `system` to follow the OS. */
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  /**
   * The open popover, owned by the app rather than by this component: a popover
   * takes the keyboard away from the board while it is open, so whoever owns
   * the board's shortcuts has to know one is open. The slot is shared with the
   * keypad's hint panel, so opening either header trigger closes that too.
   */
  openMenu: OpenMenu;
  onOpenMenuChange: (menu: OpenMenu) => void;
  /** True while a puzzle is generating; disables the controls that touch the board. */
  disabled?: boolean;
}

/**
 * The header's controls: the new-game wizard, restart, and the settings
 * popover.
 *
 * All three are the same bare stacked control the keypad's actions use — glyph
 * over grey label, no chrome (STYLE_GUIDE.md §4). Restart sits between the two
 * popovers because it belongs with New game: both start a puzzle over, and the
 * pair reads left to right from "this one again" to "a different one".
 */
export function Controls({
  size,
  difficulty,
  onStartGame,
  onRestart,
  canRestart,
  autoClearMarks,
  onAutoClearMarksChange,
  theme,
  onThemeChange,
  openMenu,
  onOpenMenuChange,
  disabled = false,
}: ControlsProps) {
  // A single slot rather than a flag each, so opening one closes the other.
  const handleNewGameOpenChange = useCallback(
    (open: boolean) => onOpenMenuChange(open ? 'new-game' : null),
    [onOpenMenuChange],
  );
  const handleSettingsOpenChange = useCallback(
    (open: boolean) => onOpenMenuChange(open ? 'settings' : null),
    [onOpenMenuChange],
  );

  const handleStartGame = useCallback(
    (nextSize: number, nextDifficulty: Difficulty) => {
      onOpenMenuChange(null);
      onStartGame(nextSize, nextDifficulty);
    },
    [onOpenMenuChange, onStartGame],
  );

  const restartUnavailable = disabled || !canRestart;

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
      {/*
        `aria-disabled` rather than `disabled`, for the same reason the popover
        triggers use it: pressing this is what empties the board, so the press
        itself is what makes the button unavailable — a real `disabled` would
        drop focus onto `<body>` in that same commit. The attribute takes the
        pointer out (see `.kk-control[aria-disabled]`), so only the keyboard
        can still reach the handler, which guards.
      */}
      <button
        type="button"
        className="kk-control kk-control--stack"
        aria-disabled={restartUnavailable || undefined}
        onClick={() => {
          if (restartUnavailable) return;
          onRestart();
        }}
      >
        <RestartIcon size={22} />
        <span className="kk-control__label">Restart</span>
      </button>
      <SettingsMenu
        autoClearMarks={autoClearMarks}
        onAutoClearMarksChange={onAutoClearMarksChange}
        theme={theme}
        onThemeChange={onThemeChange}
        open={openMenu === 'settings'}
        onOpenChange={handleSettingsOpenChange}
      />
    </div>
  );
}
