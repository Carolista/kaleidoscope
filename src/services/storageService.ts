import type { AppState } from '../types/appState'
import type { GridShapeId } from '../types/gridShape'
import { colorSchemes } from '../data/colorSchemes'
import { createInitialAppState } from '../state/appReducer'

const STORAGE_KEY = 'kaleidoscope:design'

// Bumping this invalidates any previously-persisted design whose shape no
// longer matches what loadPersistedState expects, rather than risking a
// crash trying to parse it. No migration logic yet since this is the
// first version.
const STORAGE_VERSION = 1

const VALID_GRID_SHAPES: readonly GridShapeId[] = [
	'hexagon',
	'triangle',
	'diamondStar',
	'hexagram',
	'circleRings',
	'pinwheel',
]

interface PersistedDesign {
	readonly version: typeof STORAGE_VERSION
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
	readonly shapeGroupColors: Readonly<Record<string, string>>
}

function toPersistedDesign(state: AppState): PersistedDesign {
	return {
		version: STORAGE_VERSION,
		schemeName: state.currentScheme.name,
		currentColor: state.currentColor,
		darkMode: state.darkMode,
		showEditableArea: state.showEditableArea,
		gridShape: state.gridShape,
		shapeGroupColors: state.shapeGroupColors,
	}
}

// Scheme is persisted by name and re-linked to the live `colorSchemes` data
// on load, rather than persisting the scheme object itself, so a design
// saved by one version of the app still works if a scheme's colors are
// ever tweaked later.
function fromPersistedDesign(data: PersistedDesign): AppState | null {
	const scheme = colorSchemes.find(s => s.name === data.schemeName)
	if (!scheme) return null

	return {
		currentScheme: scheme,
		currentColor: data.currentColor,
		darkMode: data.darkMode,
		showEditableArea: data.showEditableArea ?? true,
		gridShape: data.gridShape ?? 'hexagon',
		shapeGroupColors: { ...data.shapeGroupColors },
	}
}

function isPersistedDesign(value: unknown): value is PersistedDesign {
	if (typeof value !== 'object' || value === null) return false
	const data = value as Record<string, unknown>
	return (
		data.version === STORAGE_VERSION &&
		typeof data.schemeName === 'string' &&
		typeof data.currentColor === 'string' &&
		typeof data.darkMode === 'boolean' &&
		(data.showEditableArea === undefined ||
			typeof data.showEditableArea === 'boolean') &&
		(data.gridShape === undefined ||
			VALID_GRID_SHAPES.includes(data.gridShape as GridShapeId)) &&
		typeof data.shapeGroupColors === 'object' &&
		data.shapeGroupColors !== null &&
		Object.values(data.shapeGroupColors).every(c => typeof c === 'string')
	)
}

// Falls back to a fresh random-scheme state (same as a first-ever visit)
// whenever there's nothing usable to restore: no saved design, corrupted
// JSON, an unrecognized shape/version, or a scheme name that no longer
// exists. Also swallows any storage access error (e.g. disabled
// localStorage in a private-browsing mode) rather than crashing the app.
export function loadInitialAppState(): AppState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return createInitialAppState()

		const parsed: unknown = JSON.parse(raw)
		if (!isPersistedDesign(parsed)) return createInitialAppState()

		return fromPersistedDesign(parsed) ?? createInitialAppState()
	} catch {
		return createInitialAppState()
	}
}

// Used once, at startup (before the autosave effect can run), to decide
// whether to show the controls modal automatically: a design already
// existing means this isn't the device's first-ever visit.
export function hasPersistedDesign(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== null
	} catch {
		return false
	}
}

export function savePersistedState(state: AppState): void {
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
