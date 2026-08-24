import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Difficulty } from '../engine/types'
import { DIFFICULTIES } from '../engine/types'
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
 * `GridIcon` emits `size - 1` internal dividers per axis, so the divider count
 * is `2(n - 1)` and inverts cleanly. The selector is scoped to `line` because
 * the frame is a hairline too now and would otherwise be counted as a divider,
 * putting every tile's inferred order half a cell out. Counting the drawn
 * lines rather than trusting a prop is the point: this is the only way a test
 * can tell a 9x9 tile from a 4x4 one.
 */
function gridOrderOf(button: HTMLElement) {
  const hairlines = svgOf(button).querySelectorAll('line[vector-effect="non-scaling-stroke"]')
  expect(hairlines.length % 2).toBe(0)
  return hairlines.length / 2 + 1
}

/**
 * How many cells the tile's cage covers, measured off the drawn path.
 *
 * Shoelace area over one cell's area. The difficulty tile is a fixed 4x4 on
 * the shared 18-unit span, so the pitch is 4.5 and a cell is 20.25 square
 * units. Derived here rather than imported so the expectation is independent
 * of the drawing code, the same way the old heavy-edge count was.
 */
function cageCellsOf(button: HTMLElement) {
  const cage = svgOf(button).querySelector('path[fill="currentColor"]')
  if (!cage) throw new Error('No tinted cage on the tile')
  const numbers = (cage.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g) ?? []
  expect(numbers.length % 2).toBe(0)

  const points = []
  for (let i = 0; i < numbers.length; i += 2) {
    points.push([Number(numbers[i]), Number(numbers[i + 1])] as const)
  }
  let twiceArea = 0
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    twiceArea += x1 * y2 - x2 * y1
  }
  const pitch = 18 / 4
  return Math.abs(twiceArea) / 2 / (pitch * pitch)
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
     * The tile draws a fixed 4x4 board and deliberately says nothing about the
     * size chosen in step one — see `DifficultyIcon` for why the tile it
     * replaced, which drew the real n x n layout, could not survive n=9.
     *
     * Pinned rather than left implicit, because "the tile follows the chosen
     * size" is what this file used to assert and is the obvious thing for
     * someone to put back.
     */
    it('draws the same fixed 4x4 board whatever size was chosen', async () => {
      const user = userEvent.setup()
      render(<WizardHarness size={4} difficulty="easy" />)
      await openWizard(user)
      await user.click(sizeButton(9))

      for (const option of DIFFICULTIES) {
        const label = option[0].toUpperCase() + option.slice(1)
        expect(gridOrderOf(difficultyButton(label))).toBe(4)
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

    it('gives each option a cage one cell bigger than the last', async () => {
      const user = userEvent.setup()
      render(<WizardHarness size={4} />)
      await openWizard(user)
      await user.click(sizeButton(9))

      // Wired to the option, not to its position: a row that drew 1-2-3-4 by
      // index would pass a monotonicity check while showing every tile the
      // wrong cage.
      const expected: Record<string, number> = { easy: 1, medium: 2, hard: 3, expert: 4 }
      for (const option of DIFFICULTIES) {
        const label = option[0].toUpperCase() + option.slice(1)
        expect(cageCellsOf(difficultyButton(label)), label).toBe(expected[option])
      }
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
