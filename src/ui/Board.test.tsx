import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle'
import { cageIdByCell } from '../engine/types'
import { Board } from './Board'
import { computeCellEdges, edgeClassNames } from './cageBorders'

function renderBoard(overrides: Partial<ComponentProps<typeof Board>> = {}) {
  const values = new Array(16).fill(null)
  const marks = Array.from({ length: 16 }, () => [] as number[])
  const onSelect = vi.fn()
  const utils = render(
    <Board
      puzzle={SAMPLE_PUZZLE}
      values={values}
      marks={marks}
      selected={null}
      onSelect={onSelect}
      {...overrides}
    />,
  )
  return { ...utils, onSelect }
}

describe('Board', () => {
  it('renders one gridcell per puzzle cell', () => {
    renderBoard()
    expect(screen.getAllByRole('gridcell')).toHaveLength(16)
  })

  it('renders exactly one label per cage', () => {
    const { container } = renderBoard()
    const labels = container.querySelectorAll('.kk-cell__cage-label')
    expect(labels).toHaveLength(SAMPLE_PUZZLE.cages.length)
  })

  it('applies the computed cage-boundary classes to every cell', () => {
    const { container } = renderBoard()
    const cells = container.querySelectorAll('.kk-cell')
    const cageIds = cageIdByCell(SAMPLE_PUZZLE)

    // The Board's job is to apply the computed classes to the right cells;
    // whether those classes are themselves correct is covered independently
    // in cageBorders.test.ts. Asserting hard-coded cell numbers here made this
    // test break when the fixture changed, without the Board being wrong.
    expect(cells).toHaveLength(SAMPLE_PUZZLE.size * SAMPLE_PUZZLE.size)

    for (let index = 0; index < cells.length; index++) {
      const expected = edgeClassNames(computeCellEdges(SAMPLE_PUZZLE, cageIds, index))
      for (const cls of expected.split(' ').filter(Boolean)) {
        expect(cells[index].className, `cell ${index}`).toContain(cls)
      }
      // and no boundary class it should not have
      for (const cls of ['kk-cell--cage-r', 'kk-cell--cage-b', 'kk-cell--edge-r', 'kk-cell--edge-b']) {
        if (!expected.includes(cls)) {
          expect(cells[index].className, `cell ${index} should not have ${cls}`).not.toContain(cls)
        }
      }
    }

    // Sanity: the fixture must actually exercise both heavy and edge classes,
    // otherwise the loop above could pass vacuously.
    const all = [...cells].map((c) => c.className).join(' ')
    expect(all).toContain('kk-cell--cage-r')
    expect(all).toContain('kk-cell--cage-b')
    expect(all).toContain('kk-cell--edge-r')
    expect(all).toContain('kk-cell--edge-b')
  })

  it('calls onSelect with the cell index when clicked', async () => {
    const { onSelect } = renderBoard()
    const cells = screen.getAllByRole('gridcell')
    cells[5].click()
    expect(onSelect).toHaveBeenCalledWith(5)
  })

  it('marks the selected cell via aria-selected', () => {
    renderBoard({ selected: 5 })
    const cells = screen.getAllByRole('gridcell')
    expect(cells[5]).toHaveAttribute('aria-selected', 'true')
    expect(cells[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('cell aria-label describes position, cage, and value', () => {
    const values = new Array(16).fill(null)
    values[0] = 3
    renderBoard({ values })
    const cell0 = screen.getAllByRole('gridcell')[0]
    expect(cell0.getAttribute('aria-label')).toMatch(/Row 1, column 1/i)
    expect(cell0.getAttribute('aria-label')).toMatch(/value 3/i)
  })
})
