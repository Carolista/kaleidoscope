import { describe, expect, it } from 'vitest'
import { getThemeColors } from './theme'

describe('getThemeColors', () => {
  it('is white/near-black in light mode', () => {
    expect(getThemeColors(false)).toEqual({
      base: '#ffffff',
      accent: '#222222',
    })
  })

  it('swaps to near-black/white in dark mode', () => {
    expect(getThemeColors(true)).toEqual({ base: '#222222', accent: '#ffffff' })
  })
})
