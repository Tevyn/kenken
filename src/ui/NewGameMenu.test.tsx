import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Difficulty } from '../engine/types'
import { DIFFICULTIES } from '../engine/types'
import { cageLayout } from '../fixtures/cageLayouts'
import { NewGameMenu } from './NewGameMenu'

/**
 * The wizard's own tests. `Controls.test.tsx` already covers the flow through
 * the panel (which step follows which, what gets committed, focus, dismissal);
 * this file is about what the option tiles *draw*, which is the part the flow
 * tests cannot see.
 */
function WizardHarness(props: {
  size?: number
  difficulty?: Difficulty
  onStartGame?: (size: number, difficulty: Difficulty) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <NewGameMenu
      size={props.size ?? 4}
      difficulty={props.difficulty ?? 'easy'}
      onStartGame={props.onStartGame ?? vi.fn()}
      open={open}
      onOpenChange={setOpen}
    />
  )
}

const svgOf = (element: HTMLElement) => {
  const svg = element.querySelector('svg')
  if (!svg) throw new Error(`No icon inside <${element.tagName.toLowerCase()}>`)
  return svg
}

/**
 * The grid order the glyph actually drew, read back off the DOM.
 *
 * `GridIcon` emits `size - 1` internal dividers per axis and nothing else with
 * `vector-effect`, so the hairline count is `2(n - 1)` and inverts cleanly.
 * Counting the drawn lines rather than trusting a prop is the point: this is
 * the only way a test can tell a 9x9 tile from a 4x4 one.
 */
function gridOrderOf(button: HTMLElement) {
  const hairlines = svgOf(button).querySelectorAll('[vector-effect="non-scaling-stroke"]')
  expect(hairlines.length % 2).toBe(0)
  return hairlines.length / 2 + 1
}

/** Cage-boundary segments: the heavy lines, which carry no `vector-effect`. */
const cageEdgeCountOf = (button: HTMLElement) =>
  svgOf(button).querySelectorAll('line:not([vector-effect])').length

/**
 * How many heavy segments a layout should produce, derived here rather than
 * imported, so the expectation is independent of the drawing code: a boundary
 * exists wherever a cell's right or bottom neighbour is in a different cage.
 */
function heavyEdgesIn(n: number, cageIds: readonly number[]) {
  let edges = 0
  for (let index = 0; index < n * n; index += 1) {
    const col = index % n
    const row = Math.floor(index / n)
    if (col + 1 < n && cageIds[index] !== cageIds[index + 1]) edges += 1
    if (row + 1 < n && cageIds[index] !== cageIds[index + n]) edges += 1
  }
  return edges
}

const sizeButton = (n: number) => screen.getByRole('button', { name: `${n} by ${n}` })
const difficultyButton = (label: string) => screen.getByRole('button', { name: label })

const openWizard = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'New game' }))

describe('NewGameMenu tiles', () => {
  describe('the size step', () => {
    it('draws each option its own n x n grid', async () => {
      const user = userEvent.setup()
      render(<WizardHarness />)
      await openWizard(user)

      for (const n of [3, 4, 5, 6, 7, 8, 9]) {
        expect(gridOrderOf(sizeButton(n))).toBe(n)
      }
    })

    it('names itself with its visible text, spelled for speech', async () => {
      const user = userEvent.setup()
      render(<WizardHarness />)
      await openWizard(user)

      // The name is the hidden sibling, not an aria-label over the top (§4.2,
      // §6.1) - so the printed "9×9" is still there to look at.
      const button = sizeButton(9)
      expect(button).not.toHaveAttribute('aria-label')
      expect(button).toHaveTextContent('9×9')
      const printed = button.querySelector('.kk-control__label')
      expect(printed).toHaveTextContent('9×9')
      expect(printed).toHaveAttribute('aria-hidden', 'true')
      expect(button.querySelector('.kk-sr-only')).toHaveTextContent('9 by 9')
    })

    it('still marks the size being played, and only that one', async () => {
      const user = userEvent.setup()
      render(<WizardHarness size={7} />)
      await openWizard(user)

      expect(sizeButton(7)).toHaveAttribute('aria-current', 'true')
      expect(sizeButton(3)).not.toHaveAttribute('aria-current')
    })
  })

  describe('the difficulty step', () => {
    /*
     * The bug this file exists for. `size` is the board being *played* and
     * `pendingSize` the one just chosen; they are equal until the player picks
     * a different size, so a tile wired to `size` looks perfectly plausible on
     * screen. Playing a 4x4 and choosing a 9x9 is what separates them.
     */
    it('draws the size just chosen, not the size being played', async () => {
      const user = userEvent.setup()
      render(<WizardHarness size={4} difficulty="easy" />)
      await openWizard(user)
      await user.click(sizeButton(9))

      for (const option of DIFFICULTIES) {
        const label = option[0].toUpperCase() + option.slice(1)
        expect(gridOrderOf(difficultyButton(label))).toBe(9)
      }
    })

    it('restates the chosen size in the heading, spelled for speech', async () => {
      const user = userEvent.setup()
      render(<WizardHarness size={4} />)
      await openWizard(user)
      await user.click(sizeButton(9))

      const heading = screen.getByRole('heading', { name: /9 by 9.*Difficulty/ })
      expect(heading).toHaveTextContent('9×9')
      expect(heading.querySelector('[aria-hidden="true"]')).toHaveTextContent('9×9')
      expect(heading.querySelector('.kk-sr-only')).toHaveTextContent('9 by 9')
    })

    it('overdraws each option with that option’s own baked cage layout', async () => {
      const user = userEvent.setup()
      render(<WizardHarness size={4} />)
      await openWizard(user)
      await user.click(sizeButton(9))

      // Each tile's heavy-edge count is recomputed from the fixture it claims
      // to preview, which pins both halves of the lookup: a tile drawing the
      // wrong difficulty, or the right difficulty at the wrong size, misses.
      for (const option of DIFFICULTIES) {
        const label = option[0].toUpperCase() + option.slice(1)
        const expected = heavyEdgesIn(9, cageLayout(9, option).cageIds)
        expect(expected).toBeGreaterThan(0)
        expect(cageEdgeCountOf(difficultyButton(label))).toBe(expected)
      }

      // And they are visibly four different pictures, not one repeated.
      const edges = DIFFICULTIES.map((option) =>
        cageEdgeCountOf(difficultyButton(option[0].toUpperCase() + option.slice(1))),
      )
      expect(new Set(edges).size).toBeGreaterThan(1)
    })

    it('still marks the difficulty being played and lands focus on it', async () => {
      const user = userEvent.setup()
      render(<WizardHarness size={4} difficulty="hard" />)
      await openWizard(user)
      await user.click(sizeButton(6))

      expect(difficultyButton('Hard')).toHaveAttribute('aria-current', 'true')
      expect(difficultyButton('Easy')).not.toHaveAttribute('aria-current')
      expect(difficultyButton('Hard')).toHaveFocus()
    })

    it('commits the chosen size, matching the tile that was drawn', async () => {
      const user = userEvent.setup()
      const onStartGame = vi.fn()
      render(<WizardHarness size={4} onStartGame={onStartGame} />)
      await openWizard(user)
      await user.click(sizeButton(8))
      await user.click(difficultyButton('Expert'))

      expect(onStartGame).toHaveBeenCalledWith(8, 'expert')
    })
  })
})
