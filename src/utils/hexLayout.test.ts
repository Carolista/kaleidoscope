import { describe, expect, it } from 'vitest'
import {
  axialToPixel,
  boundingBox,
  hexCorners,
  pointsToSvgAttr,
} from './hexLayout'
import type { HexLayout } from './hexLayout'

const layout: HexLayout = { orientation: 'flat', size: 10 }

describe('axialToPixel', () => {
  it('places the origin cell at the pixel origin', () => {
    expect(axialToPixel({ q: 0, r: 0 }, layout)).toEqual({ x: 0, y: 0 })
  })

  it('keeps every one of the 6 neighbor directions equidistant from the center', () => {
    const neighborOffsets = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ]
    const distances = neighborOffsets.map((offset) => {
      const { x, y } = axialToPixel(offset, layout)
      return Math.hypot(x, y)
    })
    for (const d of distances) {
      expect(d).toBeCloseTo(distances[0], 10)
    }
  })

  it('supports pointy-top orientation too, with the same neighbor-distance property', () => {
    const pointyLayout: HexLayout = { orientation: 'pointy', size: 10 }
    const a = axialToPixel({ q: 0, r: 0 }, pointyLayout)
    const b = axialToPixel({ q: 1, r: 0 }, pointyLayout)
    const c = axialToPixel({ q: 0, r: 1 }, pointyLayout)
    const distA = Math.hypot(b.x - a.x, b.y - a.y)
    const distB = Math.hypot(c.x - a.x, c.y - a.y)
    expect(distA).toBeCloseTo(distB, 10)
  })
})

describe('hexCorners', () => {
  it('returns 6 corners, each exactly `size` away from the center', () => {
    const center = { x: 5, y: -5 }
    const corners = hexCorners(center, layout)
    expect(corners).toHaveLength(6)
    for (const corner of corners) {
      const dist = Math.hypot(corner.x - center.x, corner.y - center.y)
      expect(dist).toBeCloseTo(layout.size, 10)
    }
  })
})

describe('pointsToSvgAttr', () => {
  it('formats points as a space-separated "x,y" list', () => {
    expect(
      pointsToSvgAttr([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toBe('1,2 3,4')
  })
})

describe('boundingBox', () => {
  it('pads a single center by the hex size in every direction', () => {
    const box = boundingBox([{ x: 0, y: 0 }], layout)
    expect(box).toEqual({ minX: -10, minY: -10, maxX: 10, maxY: 10 })
  })
})
