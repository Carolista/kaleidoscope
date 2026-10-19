import type { ZenState } from './zenState'
import type { GridShapeId } from '@/domain/shapes'
import { palettes } from '@/domain/palettes'
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
const STORAGE_VERSION = 5

interface PersistedDesign {
	readonly version:
		| typeof LEGACY_STORAGE_VERSION
		| typeof PREVIOUS_STORAGE_VERSION
		| typeof CIRCLE_RINGS_STORAGE_VERSION
		| typeof PINWHEEL_STORAGE_VERSION
		| typeof STORAGE_VERSION
	// Stored key from before "scheme" was renamed to "palette"; keep it so saves load.
	readonly schemeName: string
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
		schemeName: state.currentPalette.name,
		currentColor: state.currentColor,
		darkMode: state.darkMode,
		showEditableArea: state.showEditableArea,
		gridShape: state.gridShape,
		gridSizes: state.gridSizes,
		shapeGroupColors: state.shapeGroupColors,
		savedBoards: state.savedBoards,
	}
}

// The palette is persisted by name and re-linked to the live `palettes` catalog
// on load, rather than persisting the palette object itself, so a design
// saved by one version of the app still works if a palette's colors are
// ever tweaked later.
function fromPersistedDesign(data: PersistedDesign): ZenState | null {
	const palette = palettes.find(s => s.name === data.schemeName)
	if (!palette) return null
	const gridShape = data.gridShape ?? 'hexagon'
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
			data.version === STORAGE_VERSION ? { ...data.savedBoards } : {},
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
			data.version === STORAGE_VERSION) &&
		typeof data.schemeName === 'string' &&
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
		(data.version !== STORAGE_VERSION || hasValidSavedBoards(data))
	)
}

// Falls back to a fresh initial state (same as a first-ever visit)
// whenever there's nothing usable to restore: no saved design, corrupted
// JSON, malformed paint maps/colors, an unrecognized shape/version, or a
// palette name that no longer exists. Also swallows any storage access error
// (e.g. disabled localStorage in a private-browsing mode) rather than crashing
// the app.
export function loadInitialZenState(): ZenState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return createInitialZenState()

		const parsed: unknown = JSON.parse(raw)
		if (!isPersistedDesign(parsed)) return createInitialZenState()

		return fromPersistedDesign(parsed) ?? createInitialZenState()
	} catch {
		return createInitialZenState()
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
