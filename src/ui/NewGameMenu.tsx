import { useEffect, useRef, useState } from 'react'
import type { Difficulty } from '../engine/types'
import { DIFFICULTIES, MAX_SIZE, MIN_SIZE } from '../engine/types'
import { NewGameIcon } from './icons'
import { Popover } from './Popover'
import './NewGameMenu.css'

/* The panel is named by whichever step heading is on screen. */
const HEADING_ID = 'kk-newgame-heading'

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i)

type Step = 'size' | 'difficulty'

interface WizardProps {
  size: number
  difficulty: Difficulty
  onStartGame: (size: number, difficulty: Difficulty) => void
}

/** The "you are here" dots. Decorative: the heading already says which step. */
function StepDots({ step }: { step: Step }) {
  return (
    <span className="kk-newgame__dots" aria-hidden="true">
      <span
        className={
          step === 'size' ? 'kk-newgame__dot kk-newgame__dot--on' : 'kk-newgame__dot'
        }
      />
      <span
        className={
          step === 'difficulty' ? 'kk-newgame__dot kk-newgame__dot--on' : 'kk-newgame__dot'
        }
      />
    </span>
  )
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
        <div className="kk-newgame__header">
          <h2 className="kk-popover__heading" id={HEADING_ID}>
            Grid size
          </h2>
          <StepDots step={step} />
        </div>
        <div className="kk-newgame__options">
          {SIZES.map((option) => (
            <button
              key={option}
              type="button"
              className="kk-control kk-newgame__option"
              aria-label={`${option} by ${option}`}
              aria-current={option === size ? 'true' : undefined}
              onClick={() => {
                setPendingSize(option)
                setStep('difficulty')
              }}
            >
              {option}×{option}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="kk-newgame__step">
      <div className="kk-newgame__header">
        {/*
          Step two shows nothing you chose in step one unless the heading says
          it — and there is no way back to check.
        */}
        <h2 className="kk-popover__heading" id={HEADING_ID}>
          <span className="kk-newgame__chosen" aria-label={`${pendingSize} by ${pendingSize}`}>
            {pendingSize}×{pendingSize}
          </span>
          <span className="kk-newgame__sep" aria-hidden="true">
            ·
          </span>
          Difficulty
        </h2>
        <StepDots step={step} />
      </div>
      <div className="kk-newgame__options kk-newgame__options--difficulty" ref={difficultyRef}>
        {DIFFICULTIES.map((option) => (
          <button
            key={option}
            type="button"
            className="kk-control kk-newgame__option"
            aria-current={option === difficulty ? 'true' : undefined}
            onClick={() => onStartGame(pendingSize, option)}
          >
            {option[0].toUpperCase() + option.slice(1)}
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
          <NewGameIcon />
          New game
        </>
      }
      triggerClassName="kk-newgame__trigger"
      open={open}
      onOpenChange={onOpenChange}
      disabled={disabled}
    >
      <NewGameWizard size={size} difficulty={difficulty} onStartGame={onStartGame} />
    </Popover>
  )
}
