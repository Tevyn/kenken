import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Hint } from '../engine/hints'
import type { HintPhase } from '../game/state'
import { HintPanel } from './HintPanel'

function hint(overrides: Partial<Hint> = {}): Hint {
  return {
    technique: 'last-cell-in-unit',
    rank: 20,
    text: 'Row 4 already has 2, 3 and 4 — the only digit left for row 4, column 4 is 1.',
    secondary: 'Last cell in a row',
    highlight: {
      focus: [15],
      support: [12, 13, 14],
      rows: [3],
      cols: [],
      cages: [],
      dimRest: true,
      strike: [],
    },
    apply: { kind: 'place', cells: [{ cell: 15, value: 1 }] },
    signature: 'last-cell-in-unit|15|1',
    ...overrides,
  }
}

function renderPanel(phase: HintPhase, onReveal?: () => void) {
  const onDismiss = vi.fn()
  const utils = render(<HintPanel phase={phase} onDismiss={onDismiss} onReveal={onReveal} />)
  return { ...utils, onDismiss }
}

describe('HintPanel', () => {
  it('shows nothing while idle, but keeps the live region mounted', () => {
    const { container } = renderPanel({ kind: 'idle' })
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).toBeInTheDocument()
    expect(live).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the hint text prominently with the technique name beneath it', () => {
    const { container } = renderPanel({ kind: 'shown', hint: hint() })
    expect(screen.getByText(/only digit left for row 4, column 4 is 1/)).toBeInTheDocument()
    expect(container.querySelector('.kk-hint__secondary')).toHaveTextContent('Last cell in a row')
  })

  it('renders whatever `secondary` the engine emitted, never a canned string', () => {
    // The engine's technique names are unit-aware: the same detector says
    // "column" here and "row" above, so the panel must not assume either.
    const { container } = renderPanel({
      kind: 'shown',
      hint: hint({ secondary: 'Last cell in a column' }),
    })
    expect(container.querySelector('.kk-hint__secondary')).toHaveTextContent(
      'Last cell in a column',
    )
  })

  it('announces the explanation in a polite live region, not a competing status role', () => {
    const { container } = renderPanel({ kind: 'shown', hint: hint() })
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).toHaveTextContent('Last cell in a row')
    expect(live).toHaveAttribute('aria-atomic', 'true')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders the mistake, stuck and solved messages the same way', () => {
    const cases = [
      { kind: 'mistake' as const, cells: [3], text: 'Something is wrong.', secondary: 'Check this cell' },
      { kind: 'stuck' as const, text: 'I can’t find a next step.', secondary: 'No forced step' },
      { kind: 'solved' as const, text: 'That’s it.', secondary: 'Solved' },
    ]
    for (const message of cases) {
      const { container, unmount } = renderPanel({ kind: 'message', message })
      expect(container.querySelector('.kk-hint__text')).toHaveTextContent(message.text)
      expect(container.querySelector('.kk-hint__secondary')).toHaveTextContent(message.secondary)
      unmount()
    }
  })

  it('dismiss button calls onDismiss', async () => {
    const user = userEvent.setup()
    const { onDismiss } = renderPanel({ kind: 'shown', hint: hint() })
    await user.click(screen.getByRole('button', { name: 'Dismiss hint' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('offers "Reveal a cell" only when stuck', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()

    const stuck = renderPanel(
      { kind: 'message', message: { kind: 'stuck', text: 'x', secondary: 'No forced step' } },
      onReveal,
    )
    await user.click(screen.getByRole('button', { name: 'Reveal a cell' }))
    expect(onReveal).toHaveBeenCalledTimes(1)
    stuck.unmount()

    renderPanel({ kind: 'shown', hint: hint() }, onReveal)
    expect(screen.queryByRole('button', { name: 'Reveal a cell' })).not.toBeInTheDocument()
  })

  it('hides the reveal button when no handler is supplied', () => {
    renderPanel({ kind: 'message', message: { kind: 'stuck', text: 'x', secondary: 'y' } })
    expect(screen.queryByRole('button', { name: 'Reveal a cell' })).not.toBeInTheDocument()
  })
})
