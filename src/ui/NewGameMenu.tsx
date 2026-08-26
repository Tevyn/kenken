import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Difficulty } from '../engine/types';
import { DIFFICULTIES, MAX_SIZE, MIN_SIZE } from '../engine/types';
import { DifficultyIcon, GridIcon, NewGameIcon } from './icons';
import { Popover } from './Popover';
import './NewGameMenu.css';

/* The panel is named by its title, which reads "New game" on both steps. */
const HEADING_ID = 'kk-newgame-heading';

/**
 * The panel's title, the same on both steps, with an optional meta line under
 * it. The title alone no longer says which step you are on — step two used to
 * restate the chosen size in its heading — so the size moves to the meta line,
 * the same split-for-screen-readers form the app header uses (App.tsx §6.1).
 *
 * Step one has nothing chosen yet, so it passes no meta; the line is still
 * rendered, and reserved by CSS, so the title and the tiles under it sit at the
 * same height on both steps and the panel does not jump as the wizard advances.
 */
function StepHeader({ meta }: { meta?: ReactNode }) {
  return (
    <div className="kk-newgame__header">
      <h2 className="kk-newgame__title" id={HEADING_ID}>
        New game
      </h2>
      <p className="kk-newgame__meta">{meta}</p>
    </div>
  );
}

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i);

/**
 * Wizard glyphs are deliberately larger than the 22px toolbar ones: these
 * carry information rather than naming an action, and the cell count in a 9x9
 * has to be *countable*. 32 is the size at which the ninth column still lands
 * on its own pixel at a 375px viewport; 28 starts to close up, 36 pushes the
 * seven size tiles past two comfortable rows in the panel.
 */
const TILE_ICON = 32;

type Step = 'size' | 'difficulty';

interface WizardProps {
  size: number;
  difficulty: Difficulty;
  onStartGame: (size: number, difficulty: Difficulty) => void;
}

/**
 * The two steps themselves.
 *
 * Its own component so that its state lives and dies with the open panel:
 * the popover unmounts its children on close, which is exactly the "reopening
 * restarts at step one" rule, with nothing left to reset.
 */
function NewGameWizard({ size, difficulty, onStartGame }: WizardProps) {
  const [step, setStep] = useState<Step>('size');
  const [pendingSize, setPendingSize] = useState(size);
  const difficultyRef = useRef<HTMLDivElement>(null);

  // Step two replaces the button that had focus, so focus has to be placed
  // again or it falls back to the body and the panel loses its keyboard flow.
  // Same rule as the popover's own entry focus: start on the current choice.
  useEffect(() => {
    if (step !== 'difficulty') return;
    const options = difficultyRef.current;
    const current = options?.querySelector<HTMLElement>('button[aria-current="true"]');
    (current ?? options?.querySelector<HTMLElement>('button'))?.focus();
  }, [step]);

  if (step === 'size') {
    return (
      <div className="kk-newgame__step">
        <StepHeader />
        <div className="kk-newgame__options">
          {SIZES.map((option) => (
            <button
              key={option}
              type="button"
              className="kk-control kk-control--stack kk-newgame__option"
              aria-current={option === size ? 'true' : undefined}
              onClick={() => {
                setPendingSize(option);
                setStep('difficulty');
              }}
            >
              <GridIcon n={option} size={TILE_ICON} />
              {/*
                The visible text is the accessible name (§4.2), so it is split
                rather than replaced by an `aria-label`: "3×3" reads aloud as
                "three times three", and the header's puzzle meta already
                solves that with a hidden sibling (§6.1). Same trick, same
                wording, so the two places the app prints N×N agree.
              */}
              <span className="kk-control__label" aria-hidden="true">
                {option}×{option}
              </span>
              <span className="kk-sr-only">{`${option} by ${option}`}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="kk-newgame__step">
      {/*
        Step two shows nothing you chose in step one unless the meta line says
        it — and there is no way back to check.
      */}
      <StepHeader
        meta={
          <>
            <span aria-hidden="true">
              {pendingSize}×{pendingSize}
            </span>
            <span className="kk-sr-only">{`${pendingSize} by ${pendingSize}`}</span>
          </>
        }
      />
      <div className="kk-newgame__options kk-newgame__options--difficulty" ref={difficultyRef}>
        {DIFFICULTIES.map((option) => (
          <button
            key={option}
            type="button"
            className="kk-control kk-control--stack kk-newgame__option"
            aria-current={option === difficulty ? 'true' : undefined}
            onClick={() => onStartGame(pendingSize, option)}
          >
            {/*
              The tile draws a fixed 4x4 board and says nothing about the size
              chosen in step one — see `DifficultyIcon` for why the previous
              tile, which drew the real n x n layout, could not. That makes the
              heading above the only place the chosen size appears on this
              step, which is why it is tested rather than merely written.
            */}
            <DifficultyIcon difficulty={option} size={TILE_ICON} />
            <span className="kk-control__label">{option[0].toUpperCase() + option.slice(1)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export interface NewGameMenuProps {
  /** The size currently being played, marked as the current choice. */
  size: number;
  /** The difficulty currently being played, marked as the current choice. */
  difficulty: Difficulty;
  /** Commit both choices at once. Only fires when a difficulty is picked. */
  onStartGame: (size: number, difficulty: Difficulty) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True while a puzzle is generating; the trigger can't start another. */
  disabled?: boolean;
  /**
   * Override the trigger's contents. The header wants the stacked glyph-over-
   * label control; the cover wants a plain text button. Same panel either way —
   * only the button that opens it changes.
   */
  trigger?: ReactNode;
  /** Class on the trigger button, paired with `trigger`. Defaults to the stacked control. */
  triggerClassName?: string;
}

/**
 * "New game" as a two-step wizard: pick a size, then a difficulty, which
 * starts the game.
 *
 * There is deliberately no way back — the wizard is two taps deep, so
 * dismissing it (Escape, or a press outside) and starting over is the cheaper
 * correction. Dismissing commits nothing.
 */
export function NewGameMenu({
  size,
  difficulty,
  onStartGame,
  open,
  onOpenChange,
  disabled = false,
  trigger,
  triggerClassName = 'kk-control--stack',
}: NewGameMenuProps) {
  return (
    <Popover
      label="New game"
      panelLabelledBy={HEADING_ID}
      trigger={
        trigger ?? (
          <>
            <NewGameIcon size={22} />
            <span className="kk-control__label">New game</span>
          </>
        )
      }
      triggerClassName={triggerClassName}
      open={open}
      onOpenChange={onOpenChange}
      disabled={disabled}
    >
      <NewGameWizard size={size} difficulty={difficulty} onStartGame={onStartGame} />
    </Popover>
  );
}
