import { describe, expect, it } from 'vitest'
import { HEX_GRID_RADIUS, generateHexCells, groupHexCells } from './hexGrid'

describe('generateHexCells', () => {
  const cells = generateHexCells()

  it('generates 271 cells at the default radius, matching the original hand-authored grid', () => {
    expect(HEX_GRID_RADIUS).toBe(9)
    expect(cells).toHaveLength(271)
  })

  it('produces the same mirror-group orbit sizes measured from the original app (1 center, 13 sixes, 16 twelves)', () => {
    const groups = groupHexCells(cells)
    expect(groups.size).toBe(30)

    const sizesByCount = new Map<number, number>()
    for (const members of groups.values()) {
      sizesByCount.set(
        members.length,
        (sizesByCount.get(members.length) ?? 0) + 1,
      )
    }

    expect(sizesByCount.get(1)).toBe(1)
    expect(sizesByCount.get(6)).toBe(13)
    expect(sizesByCount.get(12)).toBe(16)
  })

  it('marks exactly one cell per group as clickable', () => {
    const groups = groupHexCells(cells)
    for (const members of groups.values()) {
      const clickable = members.filter((cell) => cell.isClickable)
      expect(clickable).toHaveLength(1)
    }
  })

  it('treats the center cell as its own singleton group', () => {
    const center = cells.find((cell) => cell.q === 0 && cell.r === 0)
    expect(center).toBeDefined()
    expect(center!.isClickable).toBe(true)
    expect(groupHexCells(cells).get(center!.groupId)).toHaveLength(1)
  })

  it('scales to a smaller radius using the centered-hexagonal-number formula (1 + 3N(N+1))', () => {
    const radius = 2
    const small = generateHexCells(radius)
    expect(small).toHaveLength(1 + 3 * radius * (radius + 1))
  })
})
