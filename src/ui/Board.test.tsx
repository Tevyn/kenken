import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import type { HintHighlight } from '../engine/hints';
import { cageIdByCell } from '../engine/types';
import { Board } from './Board';
import { computeCellEdges, edgeClassNames } from './cageBorders';

function renderBoard(overrides: Partial<ComponentProps<typeof Board>> = {}) {
  const values = new Array(16).fill(null);
  const marks = Array.from({ length: 16 }, () => [] as number[]);
  const onSelect = vi.fn();
  const utils = render(
    <Board
      puzzle={SAMPLE_PUZZLE}
      values={values}
      marks={marks}
      selected={null}
      onSelect={onSelect}
      {...overrides}
    />,
  );
  return { ...utils, onSelect };
}

/** The board's cells in index order, for assertions that only look at classes. */
function renderBoardCells(overrides: Partial<ComponentProps<typeof Board>> = {}) {
  const { container } = renderBoard(overrides);
  return Array.from(container.querySelectorAll('.kk-cell'));
}

describe('Board', () => {
  it('renders one gridcell per puzzle cell', () => {
    renderBoard();
    expect(screen.getAllByRole('gridcell')).toHaveLength(16);
  });

  it('renders exactly one label per cage', () => {
    const { container } = renderBoard();
    const labels = container.querySelectorAll('.kk-cell__cage-label');
    expect(labels).toHaveLength(SAMPLE_PUZZLE.cages.length);
  });

  it('applies the computed cage-boundary classes to every cell', () => {
    const { container } = renderBoard();
    const cells = container.querySelectorAll('.kk-cell');
    const cageIds = cageIdByCell(SAMPLE_PUZZLE);

    // The Board's job is to apply the computed classes to the right cells;
    // whether those classes are themselves correct is covered independently
    // in cageBorders.test.ts. Asserting hard-coded cell numbers here made this
    // test break when the fixture changed, without the Board being wrong.
    expect(cells).toHaveLength(SAMPLE_PUZZLE.size * SAMPLE_PUZZLE.size);

    for (let index = 0; index < cells.length; index++) {
      const expected = edgeClassNames(computeCellEdges(SAMPLE_PUZZLE, cageIds, index));
      for (const cls of expected.split(' ').filter(Boolean)) {
        expect(cells[index].className, `cell ${index}`).toContain(cls);
      }
      // and no boundary class it should not have
      for (const cls of [
        'kk-cell--cage-r',
        'kk-cell--cage-b',
        'kk-cell--edge-r',
        'kk-cell--edge-b',
      ]) {
        if (!expected.includes(cls)) {
          expect(cells[index].className, `cell ${index} should not have ${cls}`).not.toContain(cls);
        }
      }
    }

    // Sanity: the fixture must actually exercise both heavy and edge classes,
    // otherwise the loop above could pass vacuously.
    const all = [...cells].map((c) => c.className).join(' ');
    expect(all).toContain('kk-cell--cage-r');
    expect(all).toContain('kk-cell--cage-b');
    expect(all).toContain('kk-cell--edge-r');
    expect(all).toContain('kk-cell--edge-b');
  });

  it('calls onSelect with the cell index when clicked', async () => {
    const { onSelect } = renderBoard();
    const cells = screen.getAllByRole('gridcell');
    cells[5].click();
    expect(onSelect).toHaveBeenCalledWith(5);
  });

  it('marks the selected cell via aria-selected', () => {
    renderBoard({ selected: 5 });
    const cells = screen.getAllByRole('gridcell');
    expect(cells[5]).toHaveAttribute('aria-selected', 'true');
    expect(cells[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('cell aria-label describes position, cage, and value', () => {
    const values = new Array(16).fill(null);
    values[0] = 3;
    renderBoard({ values });
    const cell0 = screen.getAllByRole('gridcell')[0];
    expect(cell0.getAttribute('aria-label')).toMatch(/Row 1, column 1/i);
    expect(cell0.getAttribute('aria-label')).toMatch(/value 3/i);
  });

  it('marks no cell as erroneous when no errors are passed', () => {
    const { container } = renderBoard();
    expect(container.querySelectorAll('.kk-cell--error')).toHaveLength(0);
    expect(container.querySelector('.kk-board__errors')).toBeEmptyDOMElement();
  });

  it('applies the error class and aria-label to exactly the reported cells', () => {
    const values = new Array(16).fill(null);
    values[0] = 3;
    values[1] = 3;
    const errors = { cells: new Set([0, 1]), duplicates: new Set([0, 1]), badCages: [] };
    const { container } = renderBoard({ values, errors });

    const cells = screen.getAllByRole('gridcell');
    expect(cells[0].className).toContain('kk-cell--error');
    expect(cells[1].className).toContain('kk-cell--error');
    expect(cells[0].getAttribute('aria-label')).toMatch(/, conflict$/);
    expect(container.querySelectorAll('.kk-cell--error')).toHaveLength(2);
    for (let i = 2; i < cells.length; i++) {
      expect(cells[i].className, `cell ${i}`).not.toContain('kk-cell--error');
      expect(cells[i].getAttribute('aria-label'), `cell ${i}`).not.toMatch(/conflict/);
    }
  });

  it('keeps a selected cell readable as both selected and erroneous', () => {
    const values = new Array(16).fill(null);
    values[0] = 3;
    const errors = { cells: new Set([0]), duplicates: new Set<number>(), badCages: [0] };
    renderBoard({ values, errors, selected: 0 });
    const cell0 = screen.getAllByRole('gridcell')[0];
    expect(cell0.className).toContain('kk-cell--selected');
    expect(cell0.className).toContain('kk-cell--error');
    expect(cell0).toHaveAttribute('aria-selected', 'true');
  });

  it('announces the conflict count in a live region', () => {
    const errors = { cells: new Set([0, 1, 4]), duplicates: new Set([0, 1, 4]), badCages: [] };
    const { container } = renderBoard({ errors });
    const region = container.querySelector('.kk-board__errors');
    expect(region).toHaveTextContent('3 cells conflict');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('uses the singular form for a lone conflict', () => {
    const errors = { cells: new Set([2]), duplicates: new Set<number>(), badCages: [1] };
    const { container } = renderBoard({ errors });
    expect(container.querySelector('.kk-board__errors')).toHaveTextContent('1 cell conflicts');
  });
});

/** A highlight with every channel in use, so precedence can be checked at once. */
function highlight(overrides: Partial<HintHighlight> = {}): HintHighlight {
  return {
    focus: [],
    support: [],
    rows: [],
    cols: [],
    cages: [],
    dimRest: false,
    strike: [],
    ...overrides,
  };
}

describe('Board hint highlighting', () => {
  it('gives every cell a role in focus > support > band > dim order', () => {
    const cells = renderBoardCells({
      // Cell 0 is in row 0, column 0 and cage 0 — every channel names it, and
      // focus still wins. Cell 1 is claimed by both support and the row band.
      highlight: highlight({ focus: [0], support: [1], rows: [0], cages: [0], dimRest: true }),
    });
    expect(cells[0].className).toContain('kk-cell--hint-focus');
    expect(cells[0].className).not.toContain('kk-cell--hint-support');
    expect(cells[1].className).toContain('kk-cell--hint-support');
    expect(cells[1].className).not.toContain('kk-cell--hint-band');
    expect(cells[2].className).toContain('kk-cell--hint-band'); // row 0 only
    expect(cells[5].className).toContain('kk-cell--hint-band'); // cage 0 only
    expect(cells[6].className).toContain('kk-cell--hint-dim'); // named by nothing
  });

  it('leaves every cell roleless when dimRest is false', () => {
    const cells = renderBoardCells({ highlight: highlight({ focus: [0] }) });
    expect(cells[0].className).toContain('kk-cell--hint-focus');
    expect(cells[6].className).not.toContain('kk-cell--hint');
  });

  it('renders no hint classes at all without a highlight', () => {
    const cells = renderBoardCells();
    for (const cell of cells) expect(cell.className).not.toContain('kk-cell--hint');
  });

  it('outlines a cage only on the sides that leave it', () => {
    // Cage 0 covers cells 0, 1 and 5: an L, so cell 1's bottom edge is open to
    // cell 5 and its left edge is open to cell 0.
    const cells = renderBoardCells({ highlight: highlight({ cages: [0] }) });
    const classes = cells[1].className;
    expect(classes).toContain('kk-cell--hint-cage-t');
    expect(classes).toContain('kk-cell--hint-cage-r');
    expect(classes).not.toContain('kk-cell--hint-cage-b');
    expect(classes).not.toContain('kk-cell--hint-cage-l');
    expect(cells[6].className).not.toContain('kk-cell--hint-cage');
  });

  it('strikes through only the ruled-out digits the player has actually written', () => {
    const marks = Array.from({ length: 16 }, () => [] as number[]);
    marks[0] = [1, 2, 3];
    const { container } = renderBoard({
      marks,
      highlight: highlight({ focus: [0], strike: [{ cell: 0, digits: [2, 4] }] }),
    });
    const cell0 = container.querySelectorAll('.kk-cell')[0];
    const struck = cell0.querySelectorAll('.kk-cell__mark--struck');
    expect(struck).toHaveLength(1);
    expect(struck[0]).toHaveTextContent('2');
  });

  /*
   * Two claims of different sizes, and the board has to be able to say either
   * without saying the other: a conflict is impossible under every solution, a
   * rejected entry is only not the answer.
   */
  it('marks a rejected cell without calling it a conflict', () => {
    const values = new Array(16).fill(null);
    values[3] = 2;
    const cells = renderBoardCells({ values, verdict: [3] });

    expect(cells[3].className).toContain('kk-cell--incorrect');
    expect(cells[3].className).not.toContain('kk-cell--error');
    expect(cells[3].getAttribute('aria-label')).toMatch(/, incorrect$/);
  });

  it('lets one cell be both, and names the stronger claim', () => {
    const values = new Array(16).fill(null);
    values[0] = 3;
    values[1] = 3;
    const errors = { cells: new Set([0, 1]), duplicates: new Set([0, 1]), badCages: [] };
    const cells = renderBoardCells({ values, errors, verdict: [0] });

    expect(cells[0].className).toContain('kk-cell--incorrect');
    expect(cells[0].className).toContain('kk-cell--error');
    expect(cells[0].getAttribute('aria-label')).toMatch(/, conflict$/);
  });

  it('keeps a cell readable as selected, wrong, and the hint’s focus at once', () => {
    const cells = renderBoardCells({
      selected: 0,
      errors: { cells: new Set([0]), duplicates: new Set([0]), badCages: [] },
      highlight: highlight({ focus: [0] }),
    });
    expect(cells[0].className).toContain('kk-cell--selected');
    expect(cells[0].className).toContain('kk-cell--error');
    expect(cells[0].className).toContain('kk-cell--hint-focus');
    expect(cells[0].getAttribute('aria-label')).toMatch(/, conflict, hint focus$/);
  });

  it('names the role in the accessible name so colour is never the only cue', () => {
    const cells = renderBoardCells({
      highlight: highlight({ focus: [0], support: [1], rows: [0], dimRest: true }),
    });
    expect(cells[0].getAttribute('aria-label')).toMatch(/, hint focus$/);
    expect(cells[1].getAttribute('aria-label')).toMatch(/, hint context$/);
    // Band and dim carry no announcement: they would be noise on most cells.
    expect(cells[2].getAttribute('aria-label')).not.toMatch(/hint/);
  });
});
