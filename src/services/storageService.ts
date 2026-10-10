import type { AppState } from '../types/appState'
import type { GridShapeId } from '../types/gridShape'
import { colorSchemes } from '../data/colorSchemes'
import { isGridShapeId } from '../data/gridShapes'
import { createInitialAppState } from '../state/appReducer'

const STORAGE_KEY = 'kaleidoscope:design'

// Bumping this invalidates any previously-persisted design whose shape no
// longer matches what loadPersistedState expects, rather than risking a
// crash trying to parse it. No migration logic yet since this is the
// first version.
const STORAGE_VERSION = 1

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

function isPersistedDesign(data: unknown): data is PersistedDesign {
	if (!isRecord(data)) return false
	return (
		data.version === STORAGE_VERSION &&
		typeof data.schemeName === 'string' &&
		isHexColor(data.currentColor) &&
		typeof data.darkMode === 'boolean' &&
		(data.showEditableArea === undefined ||
			typeof data.showEditableArea === 'boolean') &&
		(data.gridShape === undefined || isGridShapeId(data.gridShape)) &&
		isRecord(data.shapeGroupColors) &&
		Object.values(data.shapeGroupColors).every(isHexColor)
	)
}

// Falls back to a fresh random-scheme state (same as a first-ever visit)
// whenever there's nothing usable to restore: no saved design, corrupted
// JSON, malformed paint maps/colors, an unrecognized shape/version, or a
// scheme name that no longer exists. Also swallows any storage access error
// (e.g. disabled localStorage in a private-browsing mode) rather than crashing
// the app.
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
