import type {
	CatalogPalette,
	LibraryDraft,
	PaletteGroup,
	Progression,
	ProgressionGroup,
} from '@/features/admin/services'
import { generateAuthoredPuzzle, PUZZLE_RECIPES } from '@/domain/puzzles'
import { puzzleDraftArgs } from '@/features/admin/services'

const colors = ['#112233', '#223344', '#334455', '#445566', '#556677'] as const

export const palettes: CatalogPalette[] = [
	['cabo', 'Cabo'],
	['tahiti', 'Tahiti'],
	['regatta', 'Regatta'],
	['orphan', 'Orphan'],
].map(([id, name]) => ({
	id,
	name,
	colors: [...colors],
	revision: 1,
	published_at: null,
	release_at: null,
}))

const paletteGroup = (
	id: string,
	name: string,
	purpose: PaletteGroup['purpose'],
	members: string[],
): PaletteGroup => ({
	row: { id, name, purpose, published_at: null, release_at: null },
	purpose,
	members: members.map(member => ({
		id: member,
		name: palettes.find(palette => palette.id === member)?.name ?? member,
		colors: [...colors],
	})),
})

export const paletteGroups: PaletteGroup[] = [
	paletteGroup('earned', 'Earned palettes', 'reward', ['cabo', 'tahiti']),
	paletteGroup('sold', 'Sold palettes', 'pack', ['regatta']),
	paletteGroup('maybe', 'Maybe palettes', 'undecided', []),
]

const group = (
	id: string,
	name: string,
	purpose: ProgressionGroup['purpose'],
	shapeId: string,
	track: 'basic' | 'rotation',
	published = false,
): ProgressionGroup => ({ id, name, purpose, shapeId, track, published })

export function progression(overrides: Partial<Progression> = {}): Progression {
	return {
		shapeIds: ['hexagon', 'triangle'],
		groups: [
			group('hex-basic', 'Neon Nights', 'core', 'hexagon', 'basic'),
			group('hex-rotation', 'Neon Spin', 'core', 'hexagon', 'rotation'),
			group(
				'hex-bonus-basic',
				'Neon Bonus',
				'reward',
				'hexagon',
				'basic',
			),
			group(
				'hex-bonus-rotation',
				'Neon Bonus Spin',
				'reward',
				'hexagon',
				'rotation',
			),
			group('tri-basic', 'Tri Bright', 'core', 'triangle', 'basic'),
		],
		rewards: [
			{ groupId: 'hex-basic', paletteIds: ['cabo'], bonusGroupIds: [] },
		],
		locked: false,
		...overrides,
	}
}

export function draft(
	id: string,
	name: string,
	paletteId: string,
	groupName: string | null,
): LibraryDraft {
	const puzzle = generateAuthoredPuzzle(
		id,
		paletteId,
		PUZZLE_RECIPES[0],
		'hexagon',
	)
	const args = puzzleDraftArgs(id, name, puzzle)
	return {
		row: {
			id,
			name,
			shape_id: 'hexagon',
			palette_id: paletteId,
			board_size: args.p_board_size,
			rotation_allowed: args.p_rotation_allowed,
			difficulty: args.p_difficulty,
			definition: args.p_definition,
			published_at: null,
			release_at: null,
		},
		assigned: groupName !== null,
		groupId: groupName,
		groupName,
		groupPosition: groupName ? 1 : null,
		groupPurpose: groupName ? 'core' : null,
		groupTrack: null,
		puzzle,
	}
}
