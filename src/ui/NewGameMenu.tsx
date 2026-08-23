import { useEffect, useRef, useState } from 'react'
import type { Difficulty } from '../engine/types'
import { DIFFICULTIES, MAX_SIZE, MIN_SIZE } from '../engine/types'
import { cageLayout } from '../fixtures/cageLayouts'
import { CagedGridIcon, GridIcon, NewGameIcon } from './icons'
import { Popover } from './Popover'
import './NewGameMenu.css'

/* The panel is named by whichever step heading is on screen. */
const HEADING_ID = 'kk-newgame-heading'

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i)

/**
 * Wizard glyphs are deliberately larger than the 22px toolbar ones: these
 * carry information rather than naming an action, and the cell count in a 9x9
 * has to be *countable*. 32 is the size at which the ninth column still lands
 * on its own pixel at a 375px viewport; 28 starts to close up, 36 pushes the
 * seven size tiles past two comfortable rows in the panel.
 */
const TILE_ICON = 32

/**
 * Cage ids for one size/difficulty tile, or `[]` when the size is outside the
 * baked range. `cageLayout` throws a RangeError on an unsupported pair, and
 * `pendingSize` ultimately comes from a prop — a bad one must degrade to the
 * plain grid (`CagedGridIcon`'s own fallback for a wrong-length array) rather
 * than take the app down from inside render.
 */
function tileCageIds(size: number, difficulty: Difficulty): readonly number[] {
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) return []
  return cageLayout(size, difficulty).cageIds
}

type Step = 'size' | 'difficulty'

interface WizardProps {
  size: number
  difficulty: Difficulty
  onStartGame: (size: number, difficulty: Difficulty) => void
}

/**
 * The two steps themselves.
 *
 * Its own component so that its state lives and dies with the open panel:
 * the popover unmounts its children on close, which is exactly the "reopening
 * restarts at step one" rule, with nothing left to reset.
 */
function NewGameWizard({ size, difficulty, onStartGame }: WizardProps) {
  const [step, setStep] = useState<Step>('size')
  const [pendingSize, setPendingSize] = useState(size)
  const difficultyRef = useRef<HTMLDivElement>(null)

  // Step two replaces the button that had focus, so focus has to be placed
  // again or it falls back to the body and the panel loses its keyboard flow.
  // Same rule as the popover's own entry focus: start on the current choice.
  useEffect(() => {
    if (step !== 'difficulty') return
    const options = difficultyRef.current
    const current = options?.querySelector<HTMLElement>('button[aria-current="true"]')
    ;(current ?? options?.querySelector<HTMLElement>('button'))?.focus()
  }, [step])

  if (step === 'size') {
    return (
      <div className="kk-newgame__step">
        <h2 className="kk-popover__heading" id={HEADING_ID}>
          Size
        </h2>
        <div className="kk-newgame__options">
          {SIZES.map((option) => (
            <button
              key={option}
              type="button"
              className="kk-control kk-control--stack kk-newgame__option"
              aria-current={option === size ? 'true' : undefined}
              onClick={() => {
                setPendingSize(option)
                setStep('difficulty')
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
    )
  }

  return (
    <div className="kk-newgame__step">
      {/*
        Step two shows nothing you chose in step one unless the heading says
        it — and there is no way back to check.
      */}
      <h2 className="kk-popover__heading" id={HEADING_ID}>
        <span aria-hidden="true">
          {pendingSize}×{pendingSize}
        </span>
        <span className="kk-sr-only">{`${pendingSize} by ${pendingSize}`}</span>{' '}
        Difficulty
      </h2>
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
              `pendingSize`, never `size`: the tile previews the board about to
              be generated, not the one being played. The two are equal until
              the player picks a different size in step one, which is exactly
              why this is easy to get wrong and invisible on screen.
            */}
            <CagedGridIcon
              n={pendingSize}
              cageIds={tileCageIds(pendingSize, option)}
              size={TILE_ICON}
            />
            <span className="kk-control__label">
              {option[0].toUpperCase() + option.slice(1)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export interface NewGameMenuProps {
  /** The size currently being played, marked as the current choice. */
  size: number
  /** The difficulty currently being played, marked as the current choice. */
  difficulty: Difficulty
  /** Commit both choices at once. Only fires when a difficulty is picked. */
  onStartGame: (size: number, difficulty: Difficulty) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  /** True while a puzzle is generating; the trigger can't start another. */
  disabled?: boolean
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
}: NewGameMenuProps) {
  return (
    <Popover
      label="New game"
      panelLabelledBy={HEADING_ID}
      trigger={
        <>
          <NewGameIcon size={22} />
          <span className="kk-control__label">New game</span>
        </>
      }
      triggerClassName="kk-control--stack"
      open={open}
      onOpenChange={onOpenChange}
      disabled={disabled}
    >
      <NewGameWizard size={size} difficulty={difficulty} onStartGame={onStartGame} />
    </Popover>
  )
}
