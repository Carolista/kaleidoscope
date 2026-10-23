import type { ZenState } from './zenState'
import type { GridShapeId } from '@/domain/shapes'
import type { PlayerPalette } from '@/domain/palettes'
import {
	isGridShapeId,
	availableGridSizes,
	defaultGridSizes,
	isGridSize,
	legacyGridSizes,
} from '@/domain/shapes'
import { createInitialZenState } from './zenReducer'

const STORAGE_KEY = 'kaleidoscope:design'

// Backward-compatible changes are migrated inline; incompatible payloads are
// rejected when their version is not recognized.
const LEGACY_STORAGE_VERSION = 1
const PREVIOUS_STORAGE_VERSION = 2
const CIRCLE_RINGS_STORAGE_VERSION = 3
const PINWHEEL_STORAGE_VERSION = 4
const SAVED_BOARDS_STORAGE_VERSION = 5
const STORAGE_VERSION = 6

// What Zen needs from the player's content to restore a saved design.
export interface ZenContent {
	readonly palettes: readonly PlayerPalette[]
	readonly unlockedShapes: readonly GridShapeId[]
}

interface PersistedDesign {
	readonly version:
		| typeof LEGACY_STORAGE_VERSION
		| typeof PREVIOUS_STORAGE_VERSION
		| typeof CIRCLE_RINGS_STORAGE_VERSION
		| typeof PINWHEEL_STORAGE_VERSION
		| typeof SAVED_BOARDS_STORAGE_VERSION
		| typeof STORAGE_VERSION
	// Designs saved before palettes had IDs name their palette instead.
	readonly schemeName?: string
	readonly paletteId?: string
	readonly currentColor: string
	readonly darkMode: boolean
	// Optional so designs saved before this field existed still load
	// (falls back to true in fromPersistedDesign) instead of being
	// rejected outright.
	readonly showEditableArea?: boolean
	// Optional for the same reason (falls back to 'hexagon', the only
	// shape that existed before this field was added).
	readonly gridShape?: GridShapeId
	// Older saved designs have no remembered sizes and migrate their active
	// shape to the closest equivalent of its previously available grid.
	readonly gridSizes?: Partial<ZenState['gridSizes']>
	readonly shapeGroupColors: Readonly<Record<string, string>>
	readonly savedBoards?: ZenState['savedBoards']
}

function toPersistedDesign(state: ZenState): PersistedDesign {
	return {
		version: STORAGE_VERSION,
		paletteId: state.currentPalette.id,
		currentColor: state.currentColor,
		darkMode: state.darkMode,
		showEditableArea: state.showEditableArea,
		gridShape: state.gridShape,
		gridSizes: state.gridSizes,
		shapeGroupColors: state.shapeGroupColors,
		savedBoards: state.savedBoards,
	}
}

// The palette is persisted by ID and re-linked to the player's palettes on
// load, rather than persisting the palette object itself, so a design
// saved earlier still works if a palette's colors are ever corrected.
function fromPersistedDesign(
	data: PersistedDesign,
	{ palettes, unlockedShapes }: ZenContent,
): ZenState | null {
	const palette = palettes.find(item =>
		data.paletteId === undefined
			? item.name === data.schemeName
			: item.id === data.paletteId,
	)
	if (!palette) return null
	const gridShape = data.gridShape ?? 'hexagon'
	if (!unlockedShapes.includes(gridShape)) return null
	const gridSizes = data.gridSizes
		? { ...defaultGridSizes, ...data.gridSizes }
		: { ...defaultGridSizes, [gridShape]: legacyGridSizes[gridShape] }

	if (
		data.version === LEGACY_STORAGE_VERSION &&
		data.gridSizes?.hexagram === 'md'
	) {
		gridSizes.hexagram = 'lg'
	}
	if (
		data.version < CIRCLE_RINGS_STORAGE_VERSION &&
		data.gridSizes?.circleRings === 'md'
	) {
		gridSizes.circleRings = 'lg'
	}
	if (
		data.version < PINWHEEL_STORAGE_VERSION &&
		data.gridSizes?.pinwheel === 'md'
	) {
		gridSizes.pinwheel = 'lg'
	}

	return {
		currentPalette: palette,
		currentColor: data.currentColor,
		darkMode: data.darkMode,
		showEditableArea: data.showEditableArea ?? true,
		gridShape,
		gridSizes,
		shapeGroupColors: { ...data.shapeGroupColors },
		savedBoards:
			data.version >= SAVED_BOARDS_STORAGE_VERSION
				? { ...data.savedBoards }
				: {},
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHexColor(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length === 7 &&
		/^#[0-9a-f]{6}$/i.test(value)
	)
}

function hasValidSavedBoards(data: Record<string, unknown>): boolean {
	if (
		!isRecord(data.savedBoards) ||
		!isGridShapeId(data.gridShape) ||
		!isRecord(data.gridSizes)
	)
		return false
	const activeShape = data.gridShape
	const activeSize =
		isRecord(data.gridSizes) && isGridSize(data.gridSizes[activeShape])
			? data.gridSizes[activeShape]
			: defaultGridSizes[activeShape]
	return Object.entries(data.savedBoards).every(([id, paint]) => {
		const [shape, size, extra] = id.split(':')
		return (
			extra === undefined &&
			isGridShapeId(shape) &&
			isGridSize(size) &&
			availableGridSizes[shape].includes(size) &&
			id !== `${activeShape}:${activeSize}` &&
			isRecord(paint) &&
			Object.values(paint).every(isHexColor)
		)
	})
}

function isPersistedDesign(data: unknown): data is PersistedDesign {
	if (!isRecord(data)) return false
	return (
		(data.version === LEGACY_STORAGE_VERSION ||
			data.version === PREVIOUS_STORAGE_VERSION ||
			data.version === CIRCLE_RINGS_STORAGE_VERSION ||
			data.version === PINWHEEL_STORAGE_VERSION ||
			data.version === SAVED_BOARDS_STORAGE_VERSION ||
			data.version === STORAGE_VERSION) &&
		(typeof data.paletteId === 'string' ||
			typeof data.schemeName === 'string') &&
		isHexColor(data.currentColor) &&
		typeof data.darkMode === 'boolean' &&
		(data.showEditableArea === undefined ||
			typeof data.showEditableArea === 'boolean') &&
		(data.gridShape === undefined || isGridShapeId(data.gridShape)) &&
		(data.gridSizes === undefined ||
			(isRecord(data.gridSizes) &&
				Object.entries(data.gridSizes).every(
					([shape, size]) =>
						isGridShapeId(shape) &&
						isGridSize(size) &&
						availableGridSizes[shape].includes(size),
				))) &&
		isRecord(data.shapeGroupColors) &&
		Object.values(data.shapeGroupColors).every(isHexColor) &&
		(data.version < SAVED_BOARDS_STORAGE_VERSION ||
			hasValidSavedBoards(data))
	)
}

// Falls back to a fresh initial state (same as a first-ever visit)
// whenever there's nothing usable to restore: no saved design, corrupted
// JSON, malformed paint maps/colors, an unrecognized shape/version, or a
// palette that is no longer available, or a shape the player has not unlocked.
// Also swallows any storage access error (e.g. disabled localStorage in a
// private-browsing mode) rather than crashing the app.
export function loadInitialZenState(content: ZenContent): ZenState {
	const initial = () =>
		createInitialZenState(content.palettes, content.unlockedShapes[0])
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return initial()

		const parsed: unknown = JSON.parse(raw)
		if (!isPersistedDesign(parsed)) return initial()

		return fromPersistedDesign(parsed, content) ?? initial()
	} catch {
		return initial()
	}
}

// Used once, at startup (before the autosave effect can run), to decide
// whether to show the intro sequence: a design already
// existing means this isn't the device's first-ever visit.
export function hasPersistedDesign(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== null
	} catch {
		return false
	}
}

export function savePersistedState(state: ZenState): void {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify(toPersistedDesign(state)),
		)
	} catch {
		// Storage can be unavailable or full; losing autosave isn't worth
		// crashing the app over.
	}
}
