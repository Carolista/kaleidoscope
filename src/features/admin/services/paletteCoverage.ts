import type { PaletteGroupPurpose } from './groupDetails'

export interface UnavailablePalette {
	readonly paletteId: string
	readonly paletteName: string
	readonly puzzles: readonly string[]
}

// A palette a player cannot get: not in a core, reward, or pack palette group. The store will
// offer the palettes of puzzles a player plays, so these puzzles would advertise nothing.
export function findUnavailablePalettes(input: {
	readonly puzzles: readonly {
		readonly name: string
		readonly paletteId: string
		readonly groupName: string | null
	}[]
	readonly paletteGroups: readonly {
		readonly purpose: PaletteGroupPurpose
		readonly members: readonly { readonly id: string }[]
	}[]
	readonly paletteName: (paletteId: string) => string
}): UnavailablePalette[] {
	const available = new Set(
		input.paletteGroups
			.filter(group => group.purpose !== 'undecided')
			.flatMap(group => group.members.map(member => member.id)),
	)
	const missing = new Map<string, string[]>()
	// Puzzles outside any group are not headed for players yet.
	for (const puzzle of input.puzzles)
		if (puzzle.groupName !== null && !available.has(puzzle.paletteId))
			missing.set(puzzle.paletteId, [
				...(missing.get(puzzle.paletteId) ?? []),
				puzzle.name,
			])
	return [...missing]
		.map(([paletteId, puzzles]) => ({
			paletteId,
			paletteName: input.paletteName(paletteId),
			puzzles: puzzles.sort((a, b) => a.localeCompare(b)),
		}))
		.sort((a, b) => a.paletteName.localeCompare(b.paletteName))
}
