import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  EraseIcon,
  HintIcon,
  MarksIcon,
  MenuIcon,
  NewGameIcon,
  RedoIcon,
  UndoIcon,
} from './icons'

const icons = [
  ['HintIcon', HintIcon],
  ['EraseIcon', EraseIcon],
  ['UndoIcon', UndoIcon],
  ['RedoIcon', RedoIcon],
  ['MarksIcon', MarksIcon],
  ['MenuIcon', MenuIcon],
  ['NewGameIcon', NewGameIcon],
] as const

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
  ]
  const parts: string[] = []
  const walk = (el: Element) => {
    if (el !== svg) {
      const attrs = geometryAttrs
        .filter((name) => el.hasAttribute(name))
        .map((name) => `${name}=${el.getAttribute(name)}`)
        .join(',')
      parts.push(`${el.tagName}(${attrs})`)
    }
    for (const child of Array.from(el.children)) walk(child)
  }
  walk(svg)
  return parts.join('|')
}

describe('icons', () => {
  it.each(icons)('%s renders a hidden svg at the default size', (_name, Icon) => {
    const { container } = render(<Icon />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('width', '20')
    expect(svg).toHaveAttribute('height', '20')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
  })

  it.each(icons)('%s honours an explicit size', (_name, Icon) => {
    const { container } = render(<Icon size={32} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '32')
    expect(svg).toHaveAttribute('height', '32')
  })

  it.each(icons)('%s uses the shared 24x24 round-stroke system', (_name, Icon) => {
    const { container } = render(<Icon />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
    expect(svg).toHaveAttribute('fill', 'none')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveAttribute('stroke-width', '2')
    expect(svg).toHaveAttribute('stroke-linecap', 'round')
    expect(svg).toHaveAttribute('stroke-linejoin', 'round')
  })

  it.each(icons)('%s renders at least one geometry element', (_name, Icon) => {
    const { container } = render(<Icon />)
    const svg = container.querySelector('svg') as SVGSVGElement
    expect(serializeGeometry(svg).length).toBeGreaterThan(0)
  })

  it('every icon renders distinct glyph geometry', () => {
    const seen = new Map<string, string>()
    for (const [name, Icon] of icons) {
      const { container } = render(<Icon />)
      const svg = container.querySelector('svg') as SVGSVGElement
      const geometry = serializeGeometry(svg)
      const clashingName = seen.get(geometry)
      expect(
        clashingName,
        `${name} renders the same geometry as ${String(clashingName)}`,
      ).toBeUndefined()
      seen.set(geometry, name)
    }
  })

  it('UndoIcon and RedoIcon are mirror images, not copies of each other', () => {
    const { container: undoContainer } = render(<UndoIcon />)
    const { container: redoContainer } = render(<RedoIcon />)
    const undoGeometry = serializeGeometry(undoContainer.querySelector('svg') as SVGSVGElement)
    const redoGeometry = serializeGeometry(redoContainer.querySelector('svg') as SVGSVGElement)
    expect(undoGeometry).not.toEqual(redoGeometry)
  })
})
