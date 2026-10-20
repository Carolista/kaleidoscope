import { PUZZLE_RECIPES, type PuzzleRecipe } from '@/domain/puzzles'

// A group is any collection of puzzles or palettes. Its purpose says how it is used; puzzle
// groups also carry a track (rotation rule). "Group" is admin/database wording only.
export const PUZZLE_GROUP_PURPOSES = [
	'undecided',
	'core',
	'reward',
	'daily',
	'pack',
] as const
export type PuzzleGroupPurpose = (typeof PUZZLE_GROUP_PURPOSES)[number]

export const PALETTE_GROUP_PURPOSES = [
	'undecided',
	'core',
	'reward',
	'pack',
] as const
export type PaletteGroupPurpose = (typeof PALETTE_GROUP_PURPOSES)[number]

export const PUZZLE_GROUP_TRACKS = ['basic', 'rotation', 'mixed'] as const
export type PuzzleGroupTrack = (typeof PUZZLE_GROUP_TRACKS)[number]

export const puzzleGroupPurposeLabels: Record<PuzzleGroupPurpose, string> = {
	undecided: 'Undecided',
	core: 'Core',
	reward: 'Reward',
	daily: 'Daily',
	pack: 'Pack',
}
export const paletteGroupPurposeLabels: Record<PaletteGroupPurpose, string> = {
	undecided: 'Undecided',
	core: 'Core',
	reward: 'Reward',
	pack: 'Pack',
}
export const puzzleGroupTrackLabels: Record<PuzzleGroupTrack, string> = {
	basic: 'Basic',
	rotation: 'Rotation',
	mixed: 'Mixed',
}

export function isPuzzleGroupPurpose(
	value: string,
): value is PuzzleGroupPurpose {
	return PUZZLE_GROUP_PURPOSES.some(purpose => purpose === value)
}

export function isPaletteGroupPurpose(
	value: string,
): value is PaletteGroupPurpose {
	return PALETTE_GROUP_PURPOSES.some(purpose => purpose === value)
}

export function isPuzzleGroupTrack(value: string): value is PuzzleGroupTrack {
	return PUZZLE_GROUP_TRACKS.some(track => track === value)
}

// Daily groups may mix shapes; every other puzzle group has exactly one.
export function purposeHasShape(purpose: string): boolean {
	return purpose !== 'daily'
}

// Core and reward groups are basic or rotation; packs may also mix. Others have no track.
export function tracksForPurpose(purpose: string): readonly PuzzleGroupTrack[] {
	if (purpose === 'core' || purpose === 'reward') return ['basic', 'rotation']
	if (purpose === 'pack') return PUZZLE_GROUP_TRACKS
	return []
}

// Keeps the current track when the purpose still allows it; otherwise the first allowed one.
export function trackForPurpose(
	purpose: string,
	current: PuzzleGroupTrack | null,
): PuzzleGroupTrack | null {
	const allowed = tracksForPurpose(purpose)
	if (current && allowed.includes(current)) return current
	return allowed[0] ?? null
}

// Mirrors the database rule for which puzzles a group can hold.
export function groupAcceptsPuzzle(
	group: { readonly shape_id: string | null; readonly track: string | null },
	puzzle: {
		readonly shape_id: string
		readonly rotation_allowed: boolean
	},
): boolean {
	if (group.shape_id !== null && group.shape_id !== puzzle.shape_id)
		return false
	if (group.track === 'basic') return !puzzle.rotation_allowed
	if (group.track === 'rotation') return puzzle.rotation_allowed
	return true
}

// Recipes a puzzle may use in a group with this track; mixed or no track allows all.
export function recipesForTrack(track: string | null): readonly PuzzleRecipe[] {
	if (track === 'basic')
		return PUZZLE_RECIPES.filter(recipe => !recipe.rotation)
	if (track === 'rotation')
		return PUZZLE_RECIPES.filter(recipe => recipe.rotation)
	return PUZZLE_RECIPES
}
