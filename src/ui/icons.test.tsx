import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../engine/types';
import { DIFFICULTIES } from '../engine/types';
import type { IconProps } from './icons';
import {
  CorrectnessIcon,
  DifficultyIcon,
  EraseIcon,
  GridIcon,
  HintIcon,
  MarksIcon,
  MenuIcon,
  NewGameIcon,
  NumberIcon,
  RedoIcon,
  RestartIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
  ThemeSystemIcon,
  TipIcon,
  UndoIcon,
} from './icons';

const icons = [
  ['HintIcon', HintIcon],
  ['EraseIcon', EraseIcon],
  ['UndoIcon', UndoIcon],
  ['RedoIcon', RedoIcon],
  ['MarksIcon', MarksIcon],
  ['MenuIcon', MenuIcon],
  ['NewGameIcon', NewGameIcon],
  ['RestartIcon', RestartIcon],
  ['CorrectnessIcon', CorrectnessIcon],
  ['TipIcon', TipIcon],
  ['NumberIcon', NumberIcon],
] as const;

/** Parameterised icons, wrapped so they take the same bare props as the rest. */
const gridIcons = [
  ['GridIcon(3)', (props: IconProps) => <GridIcon n={3} {...props} />],
  ['GridIcon(9)', (props: IconProps) => <GridIcon n={9} {...props} />],
  ...DIFFICULTIES.map(
    (difficulty) =>
      [
        `DifficultyIcon(${difficulty})`,
        (props: IconProps) => <DifficultyIcon difficulty={difficulty} {...props} />,
      ] as const,
  ),
] as const;

const newIcons = [
  ...gridIcons,
  ['ThemeLightIcon', ThemeLightIcon],
  ['ThemeDarkIcon', ThemeDarkIcon],
  ['ThemeSystemIcon', ThemeSystemIcon],
] as const;

const svgOf = (container: HTMLElement) => container.querySelector('svg') as SVGSVGElement;

/**
 * Serializes an svg's child geometry (element tag plus every geometry
 * attribute, recursing into <g> wrappers) into a comparable string. Two
 * icons that render the same shape produce the same string; a regression
 * like `RedoIcon` accidentally rendering `UndoIcon`'s path fails a
 * distinctness check built on this.
 */
function serializeGeometry(svg: SVGSVGElement): string {
  const geometryAttrs = [
    'd',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'width',
    'height',
    'transform',
  ];
  const parts: string[] = [];
  const walk = (el: Element) => {
    if (el !== svg) {
      const attrs = geometryAttrs
        .filter((name) => el.hasAttribute(name))
        .map((name) => `${name}=${el.getAttribute(name)}`)
        .join(',');
      parts.push(`${el.tagName}(${attrs})`);
    }
    for (const child of Array.from(el.children)) walk(child);
  };
  walk(svg);
  return parts.join('|');
}

describe('icons', () => {
  it.each(icons)('%s renders a hidden svg at the default size', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it.each(icons)('%s honours an explicit size', (_name, Icon) => {
    const { container } = render(<Icon size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it.each(icons)('%s uses the shared 24x24 round-stroke system', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '2');
    expect(svg).toHaveAttribute('stroke-linecap', 'round');
    expect(svg).toHaveAttribute('stroke-linejoin', 'round');
  });

  it.each(icons)('%s renders at least one geometry element', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(serializeGeometry(svg).length).toBeGreaterThan(0);
  });

  it('every icon renders distinct glyph geometry', () => {
    const seen = new Map<string, string>();
    for (const [name, Icon] of icons) {
      const { container } = render(<Icon />);
      const svg = container.querySelector('svg') as SVGSVGElement;
      const geometry = serializeGeometry(svg);
      const clashingName = seen.get(geometry);
      expect(
        clashingName,
        `${name} renders the same geometry as ${String(clashingName)}`,
      ).toBeUndefined();
      seen.set(geometry, name);
    }
  });

  it('NewGameIcon and RestartIcon are mirror images, not copies of each other', () => {
    const { container: newGameContainer } = render(<NewGameIcon />);
    const { container: restartContainer } = render(<RestartIcon />);
    expect(serializeGeometry(newGameContainer.querySelector('svg') as SVGSVGElement)).not.toEqual(
      serializeGeometry(restartContainer.querySelector('svg') as SVGSVGElement),
    );
  });

  it('CorrectnessIcon draws a tick and a cross, not a lone tick', () => {
    // A single mark is the "you win" glyph. This control is offered mid-solve
    // on a board that may be entirely wrong, so the cross has to be there.
    const { container } = render(<CorrectnessIcon />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg.querySelectorAll('path, line')).toHaveLength(3);
  });

  it('TipIcon is its own glyph, not the lightbulb that opens the menu', () => {
    const { container: tipContainer } = render(<TipIcon />);
    const { container: hintContainer } = render(<HintIcon />);
    const tip = serializeGeometry(tipContainer.querySelector('svg') as SVGSVGElement);
    const hint = serializeGeometry(hintContainer.querySelector('svg') as SVGSVGElement);
    expect(tip).not.toEqual(hint);
  });

  it('NumberIcon fills the cell it marks rather than outlining it', () => {
    // The inherited 2-unit stroke would grow the block back out over the grid
    // lines around it, so the filled square opts out of the shell's stroke.
    const { container } = render(<NumberIcon />);
    const filled = container.querySelector('[fill="currentColor"]');
    expect(filled).not.toBeNull();
    expect(filled).toHaveAttribute('stroke', 'none');
  });

  it('UndoIcon and RedoIcon are mirror images, not copies of each other', () => {
    const { container: undoContainer } = render(<UndoIcon />);
    const { container: redoContainer } = render(<RedoIcon />);
    const undoGeometry = serializeGeometry(undoContainer.querySelector('svg') as SVGSVGElement);
    const redoGeometry = serializeGeometry(redoContainer.querySelector('svg') as SVGSVGElement);
    expect(undoGeometry).not.toEqual(redoGeometry);
  });
});

describe('grid and theme icons', () => {
  it.each(newIcons)('%s renders a hidden svg at the default size', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = svgOf(container);
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '20');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it.each(newIcons)('%s honours an explicit size', (_name, Icon) => {
    const { container } = render(<Icon size={28} />);
    const svg = svgOf(container);
    expect(svg).toHaveAttribute('width', '28');
    expect(svg).toHaveAttribute('height', '28');
  });

  it.each(newIcons)('%s uses the shared 24x24 round-stroke system', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = svgOf(container);
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '2');
  });

  /*
   * The glyphs render as accent ink and must inherit it (STYLE_GUIDE §4.1), so
   * no child may name a colour of its own — a hardcoded `stroke` or `fill`
   * would survive into a theme it was not drawn for.
   *
   * `fill` is allowed to be present but only ever as `currentColor` (or the
   * shell's `none`), which is inheritance rather than a colour: `NumberIcon`
   * has filled its one cell that way since before this suite existed, and
   * `DifficultyIcon` tints its cage the same way. Anything else is a literal.
   */
  it.each(newIcons)('%s paints nothing but inherited currentColor', (_name, Icon) => {
    const { container } = render(<Icon />);
    for (const el of Array.from(svgOf(container).querySelectorAll('*'))) {
      expect(el.getAttribute('stroke')).toBeNull();
      const fill = el.getAttribute('fill');
      if (fill !== null) expect(['currentColor', 'none']).toContain(fill);
    }
  });

  it.each(newIcons)('%s is distinct from every toolbar icon', (_name, Icon) => {
    const { container } = render(<Icon />);
    const geometry = serializeGeometry(svgOf(container));
    for (const [otherName, Other] of icons) {
      const { container: otherContainer } = render(<Other />);
      expect(geometry, `matches ${otherName}`).not.toEqual(
        serializeGeometry(svgOf(otherContainer)),
      );
    }
  });

  describe('GridIcon', () => {
    // n-1 dividers per axis, both axes: 2 at n=3, 8 at n=9.
    it.each([
      [3, 4],
      [9, 16],
    ])('n=%i draws %i internal dividers', (n, expected) => {
      const { container } = render(<GridIcon n={n} />);
      const svg = svgOf(container);
      expect(svg.querySelectorAll('line')).toHaveLength(expected);
      expect(svg.querySelectorAll('rect')).toHaveLength(1);
    });

    it('spaces the dividers evenly across the outer square', () => {
      const { container } = render(<GridIcon n={3} />);
      const svg = svgOf(container);
      const verticals = Array.from(svg.querySelectorAll('line'))
        .filter((line) => line.getAttribute('x1') === line.getAttribute('x2'))
        .map((line) => Number(line.getAttribute('x1')));
      // 18-unit span from 3 to 21, so the two internal lines land on 9 and 15.
      expect(verticals).toEqual([9, 15]);
    });

    /*
     * A size tile is one weight throughout: the frame is drawn with exactly the
     * divider's hairline treatment, not merely a matching number. Width, alpha
     * and both rendering hints are asserted together, because a frame that
     * measured 1 unit in viewBox space while the dividers measured 1 CSS pixel
     * would pass a width-only check and still render as two different strokes.
     */
    it.each([3, 5, 9])('draws every stroke at one weight at n=%i', (n) => {
      const { container } = render(<GridIcon n={n} />);
      const svg = svgOf(container);
      const strokes = Array.from(svg.querySelectorAll('rect, line'));
      expect(strokes).toHaveLength(2 * (n - 1) + 1);
      for (const el of strokes) {
        expect(el).toHaveAttribute('stroke-width', '1');
        expect(el).toHaveAttribute('stroke-opacity', '0.55');
        expect(el).toHaveAttribute('vector-effect', 'non-scaling-stroke');
        expect(el).toHaveAttribute('shape-rendering', 'crispEdges');
      }
    });

    /*
     * The weight hierarchy still holds where there is one to hold: the caged
     * glyph (`DifficultyIcon`) keeps its outline heaviest. Asserted here so that
     * flattening the size tile stays a change to `GridIcon` alone rather than a
     * quiet edit to the shared `gridFrame`.
     */
    it('leaves the caged glyph outline at full weight', () => {
      const { container } = render(<DifficultyIcon difficulty="easy" />);
      const rect = svgOf(container).querySelector('rect') as SVGRectElement;
      expect(rect).toHaveAttribute('stroke-width', '2');
      expect(rect).not.toHaveAttribute('stroke-opacity');
      expect(rect).not.toHaveAttribute('vector-effect');
    });

    /*
     * The fix for n=9 silting up into a solid block: dividers are one device
     * pixel, snapped to the pixel grid, at every render size. Losing either
     * attribute puts the sub-pixel wash back.
     */
    it('draws dividers as pixel-snapped non-scaling hairlines', () => {
      const { container } = render(<GridIcon n={9} />);
      for (const line of Array.from(svgOf(container).querySelectorAll('line'))) {
        expect(line).toHaveAttribute('stroke-width', '1');
        expect(line).toHaveAttribute('vector-effect', 'non-scaling-stroke');
        expect(line).toHaveAttribute('shape-rendering', 'crispEdges');
      }
    });

    it('renders the same envelope at every n', () => {
      for (const n of [3, 4, 5, 6, 7, 8, 9]) {
        const { container } = render(<GridIcon n={n} />);
        const rect = svgOf(container).querySelector('rect') as SVGRectElement;
        expect(rect).toHaveAttribute('x', '3');
        expect(rect).toHaveAttribute('y', '3');
        expect(rect).toHaveAttribute('width', '18');
        expect(rect).toHaveAttribute('height', '18');
      }
    });

    it('degrades rather than throwing on an impossible n', () => {
      for (const n of [0, -4, 99, Number.NaN]) {
        const { container } = render(<GridIcon n={n} />);
        expect(svgOf(container).querySelectorAll('line').length).toBeGreaterThan(0);
      }
    });
  });

  describe('DifficultyIcon', () => {
    /*
     * The whole point of the glyph, asserted by measuring what it drew rather
     * than by counting corners: a cage with the right number of corners in the
     * wrong places would pass a corner count and still be the wrong shape.
     *
     * Shoelace area over one cell's area. The board is fixed at 4x4 and the
     * span is 18 units, so the pitch is 4.5 and a cell is 20.25 square units.
     */
    const cageCellsIn = (svg: SVGSVGElement) => {
      const cage = svg.querySelector('path[fill="currentColor"]');
      if (!cage) throw new Error('No tinted cage in the glyph');
      const numbers = (cage.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g) ?? [];
      expect(numbers.length).toBeGreaterThan(0);
      expect(numbers.length % 2).toBe(0);

      const points = [];
      for (let i = 0; i < numbers.length; i += 2) {
        points.push([Number(numbers[i]), Number(numbers[i + 1])] as const);
      }
      let twiceArea = 0;
      for (let i = 0; i < points.length; i += 1) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        twiceArea += x1 * y2 - x2 * y1;
      }
      const pitch = 18 / 4;
      return Math.abs(twiceArea) / 2 / (pitch * pitch);
    };

    it.each([
      ['easy', 1],
      ['medium', 2],
      ['hard', 3],
      ['expert', 4],
    ] as const)('%s draws a cage of %i cell(s)', (difficulty, cells) => {
      const { container } = render(<DifficultyIcon difficulty={difficulty} />);
      expect(cageCellsIn(svgOf(container))).toBe(cells);
    });

    /*
     * The ramp itself. Asserted as a strictly increasing sequence rather than
     * as four independent numbers, because the failure this guards against is
     * the one the old tile actually had: a row of pictures whose ink ran the
     * opposite way to the words underneath.
     */
    it('grows monotonically across DIFFICULTIES', () => {
      const cells = DIFFICULTIES.map((difficulty) => {
        const { container } = render(<DifficultyIcon difficulty={difficulty} />);
        return cageCellsIn(svgOf(container));
      });
      for (let i = 1; i < cells.length; i += 1) {
        expect(cells[i], `${DIFFICULTIES[i]} vs ${DIFFICULTIES[i - 1]}`).toBeGreaterThan(
          cells[i - 1],
        );
      }
    });

    it('draws four distinct glyphs', () => {
      const seen = new Set(
        DIFFICULTIES.map((difficulty) => {
          const { container } = render(<DifficultyIcon difficulty={difficulty} />);
          return serializeGeometry(svgOf(container));
        }),
      );
      expect(seen.size).toBe(DIFFICULTIES.length);
    });

    /*
     * The board under the cage is fixed at 4x4 whatever the difficulty, and
     * whatever size the player picked in step one - that is the change this
     * glyph exists to make, so it is pinned here rather than left implicit.
     */
    it.each(DIFFICULTIES)('%s draws the same fixed 4x4 board', (difficulty) => {
      const { container } = render(<DifficultyIcon difficulty={difficulty} />);
      const svg = svgOf(container);
      // 3 internal dividers per axis at n=4.
      expect(svg.querySelectorAll('line')).toHaveLength(6);
      const rect = svg.querySelector('rect') as SVGRectElement;
      expect(rect).toHaveAttribute('x', '3');
      expect(rect).toHaveAttribute('y', '3');
      expect(rect).toHaveAttribute('width', '18');
      expect(rect).toHaveAttribute('height', '18');
    });

    /*
     * Three weights in one box, frame over cage over divider (§5): the frame is
     * never beaten, and the cage never drops to the divider's.
     */
    it('keeps the cage between the divider and the frame', () => {
      const { container } = render(<DifficultyIcon difficulty="expert" />);
      const svg = svgOf(container);
      const frame = Number(
        (svg.querySelector('rect') as SVGRectElement).getAttribute('stroke-width'),
      );
      const cage = Number(
        (svg.querySelector('path') as SVGPathElement).getAttribute('stroke-width'),
      );
      expect(cage).toBeLessThanOrEqual(frame);
      expect(cage).toBeGreaterThan(1);
      for (const line of Array.from(svg.querySelectorAll('line'))) {
        expect(line).toHaveAttribute('stroke-width', '1');
        expect(line).toHaveAttribute('stroke-opacity', '0.55');
      }
    });

    /*
     * `difficulty` reaches the glyph from a prop, so a value outside the union
     * has to degrade rather than render a cage-less tile or throw inside the
     * wizard's render.
     */
    it('degrades to the easy cage on an unknown difficulty', () => {
      const { container: bad } = render(<DifficultyIcon difficulty={'impossible' as Difficulty} />);
      const { container: easy } = render(<DifficultyIcon difficulty="easy" />);
      expect(serializeGeometry(svgOf(bad))).toEqual(serializeGeometry(svgOf(easy)));
    });
  });
});
