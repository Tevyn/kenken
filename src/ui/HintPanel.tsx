import type { HintPhase } from '../game/state'
import './HintPanel.css'

export interface HintPanelProps {
  phase: HintPhase
  /** Dismiss the explanation without applying it. */
  onDismiss: () => void
  /** The `stuck` escape hatch. Omit to hide the reveal button entirely. */
  onReveal?: () => void
}

/** `text` on top, `secondary` beneath — the same layout for a hint or a message. */
function contentOf(phase: HintPhase): { text: string; secondary: string } | null {
  if (phase.kind === 'shown') return { text: phase.hint.text, secondary: phase.hint.secondary }
  if (phase.kind === 'message') {
    return { text: phase.message.text, secondary: phase.message.secondary }
  }
  return null
}

/**
 * The hint banner: what the engine worked out, in the engine's own words.
 *
 * Every string here comes from the `Hint` or the message arm — the technique
 * names are unit-aware ("Last cell in a column"), so hardcoding any of them
 * would eventually print the wrong one.
 *
 * The wrapper stays mounted while idle so the live region exists before its
 * content changes; a region inserted at the same moment as its text is not
 * reliably announced.
 */
export function HintPanel({ phase, onDismiss, onReveal }: HintPanelProps) {
  const content = contentOf(phase)
  const stuck = phase.kind === 'message' && phase.message.kind === 'stuck'

  return (
    <div className="kk-hint" data-empty={content === null ? '' : undefined}>
      {/*
        A bare live region rather than `role="status"`: App already uses that
        role for the loading and win messages, and a third one would leave three
        announcements competing for the same landmark.
      */}
      <div className="kk-hint__live" aria-live="polite" aria-atomic="true">
        {content && (
          <div className="kk-hint__body">
            <p className="kk-hint__text">{content.text}</p>
            <p className="kk-hint__secondary">{content.secondary}</p>
          </div>
        )}
      </div>

      {content && (
        <div className="kk-hint__actions">
          {stuck && onReveal && (
            <button type="button" className="kk-control kk-hint__reveal" onClick={onReveal}>
              Reveal a cell
            </button>
          )}
          <button
            type="button"
            className="kk-control kk-hint__dismiss"
            onClick={onDismiss}
            aria-label="Dismiss hint"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
