import { useCallback } from 'react';
import type { Difficulty } from '../engine/types';
import type { Theme } from '../game/preferences';
import { DifficultyIcon } from './icons';
import { HowToPlayMenu } from './HowToPlayMenu';
import { NewGameMenu } from './NewGameMenu';
import type { OpenMenu } from './Popover';
import { SettingsMenu } from './SettingsMenu';
import './Cover.css';

export interface CoverProps {
  /** False when there is no saved or in-progress game; Continue is then inert. */
  canContinue: boolean;
  /** Resume the current game and leave the cover for the board. */
  onContinue: () => void;
  /** The size the wizard should mark as current — the game waiting behind the cover. */
  size: number;
  /** The difficulty the wizard should mark as current. */
  difficulty: Difficulty;
  /** Commit a new game. The cover closes the wizard; the app switches screens. */
  onStartGame: (size: number, difficulty: Difficulty) => void;
  autoClearMarks: boolean;
  onAutoClearMarksChange: (enabled: boolean) => void;
  autoFillSingleCages: boolean;
  onAutoFillSingleCagesChange: (enabled: boolean) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  /** The shared open-popover slot, owned by the app. */
  openMenu: OpenMenu;
  onOpenMenuChange: (menu: OpenMenu) => void;
  /**
   * True while a puzzle is generating. The cover holds still rather than
   * flashing an unrelated board on its way to the game: it disables its actions
   * and says so, and the app switches to the board once generation lands.
   */
  loading?: boolean;
  /** A generation failure, shown in place so the player sees why nothing happened. */
  error?: string | null;
}

/**
 * The title screen: the logo and wordmark over four choices — resume, start,
 * learn, configure.
 *
 * The logo is the Hard difficulty tile drawn large (`DifficultyIcon`) — the
 * app's own grid-and-cage mark, the same one on the browser tab. New game and
 * Settings reuse the header's popovers verbatim, only with a cover-styled
 * trigger; How to play is the one panel that lives only here, because the
 * board's own controls are self-explanatory and need no manual.
 */
export function Cover({
  canContinue,
  onContinue,
  size,
  difficulty,
  onStartGame,
  autoClearMarks,
  onAutoClearMarksChange,
  autoFillSingleCages,
  onAutoFillSingleCagesChange,
  theme,
  onThemeChange,
  openMenu,
  onOpenMenuChange,
  loading = false,
  error,
}: CoverProps) {
  const handleNewGameOpenChange = useCallback(
    (open: boolean) => onOpenMenuChange(open ? 'new-game' : null),
    [onOpenMenuChange],
  );
  const handleHowToPlayOpenChange = useCallback(
    (open: boolean) => onOpenMenuChange(open ? 'how-to-play' : null),
    [onOpenMenuChange],
  );
  const handleSettingsOpenChange = useCallback(
    (open: boolean) => onOpenMenuChange(open ? 'settings' : null),
    [onOpenMenuChange],
  );

  // Close the wizard the moment it commits, exactly as the header does: the
  // app then generates and switches to the board.
  const handleStartGame = useCallback(
    (nextSize: number, nextDifficulty: Difficulty) => {
      onOpenMenuChange(null);
      onStartGame(nextSize, nextDifficulty);
    },
    [onOpenMenuChange, onStartGame],
  );

  const continueUnavailable = loading || !canContinue;

  return (
    <div className="kk-cover">
      <div className="kk-cover__brand">
        <DifficultyIcon difficulty="hard" size={112} className="kk-cover__logo" />
        <h1 className="kk-cover__title">KenKen</h1>
      </div>

      {error && (
        <p role="alert" className="kk-app__error kk-cover__error">
          {error}
        </p>
      )}

      <div className="kk-cover__actions">
        {/*
          `aria-disabled` rather than `disabled`, the same choice the header's
          controls make: the button stays focusable and reachable, and the
          handler guards. A disabled Continue on first launch is not an error
          state — it just has nothing to resume yet.
        */}
        <button
          type="button"
          className="kk-control kk-cover__action"
          aria-disabled={continueUnavailable || undefined}
          onClick={() => {
            if (continueUnavailable) return;
            onContinue();
          }}
        >
          Continue
        </button>

        <NewGameMenu
          size={size}
          difficulty={difficulty}
          onStartGame={handleStartGame}
          open={openMenu === 'new-game'}
          onOpenChange={handleNewGameOpenChange}
          disabled={loading}
          trigger="New game"
          triggerClassName="kk-cover__action"
        />

        <HowToPlayMenu
          open={openMenu === 'how-to-play'}
          onOpenChange={handleHowToPlayOpenChange}
          onStartGame={handleStartGame}
          trigger="How to play"
          triggerClassName="kk-cover__action"
        />

        <SettingsMenu
          autoClearMarks={autoClearMarks}
          onAutoClearMarksChange={onAutoClearMarksChange}
          autoFillSingleCages={autoFillSingleCages}
          onAutoFillSingleCagesChange={onAutoFillSingleCagesChange}
          theme={theme}
          onThemeChange={onThemeChange}
          open={openMenu === 'settings'}
          onOpenChange={handleSettingsOpenChange}
          trigger="Settings"
          triggerClassName="kk-cover__action"
        />
      </div>

      {loading && (
        <p className="kk-cover__status" role="status">
          Generating…
        </p>
      )}
    </div>
  );
}
