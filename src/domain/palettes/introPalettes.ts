import type { PlayerPalette } from './palette'

// Each tutorial starts with its own core palette, by database ID.
export const INTRO_PALETTE_IDS = {
	zen: '452de37d-080d-486c-9435-051c5e3d8aef', // Harmony
	basic: 'e5b99f36-c2c8-4320-8803-d237f0f9385f', // Mindfulness
	rotation: '28ee4a2d-d5fc-4278-be71-5595241f1bfb', // Stillness
} as const

export type IntroPaletteKey = keyof typeof INTRO_PALETTE_IDS

// Falls back to the first palette if the tutorial's palette is not available.
export function findIntroPalette(
	palettes: readonly PlayerPalette[],
	key: IntroPaletteKey,
): PlayerPalette {
	return (
		palettes.find(palette => palette.id === INTRO_PALETTE_IDS[key]) ??
		palettes[0]
	)
}
