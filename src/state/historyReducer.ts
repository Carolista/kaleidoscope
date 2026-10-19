import type { AppState, PaintMap } from '@/types/appState'
import type { AppAction } from './appReducer'
import { supportedGridShapes } from '@/domain/shapes'
import { appReducer } from './appReducer'
import { getThemeColors } from './theme'

// Only the design content itself is undoable — picking a current color or
// toggling dark mode are just viewing/tool choices, not something a user
// would expect "undo" to step back through.
const UNDOABLE_ACTION_TYPES = new Set<AppAction['type']>([
	'SELECT_SCHEME',
	'PAINT_SHAPE_GROUP',
	'RESET_DESIGN',
	'RANDOMIZE_DESIGN',
	'SELECT_GRID_SHAPE',
	'SELECT_GRID_SIZE',
])

type DesignSnapshot = Pick<
	AppState,
	| 'currentScheme'
	| 'gridShape'
	| 'gridSizes'
	| 'shapeGroupColors'
	| 'savedBoards'
>

export interface HistoryState {
	readonly present: AppState
	readonly past: readonly DesignSnapshot[]
	readonly future: readonly DesignSnapshot[]
}

export type HistoryAction =
	AppAction | { readonly type: 'UNDO' } | { readonly type: 'REDO' }

export function createInitialHistoryState(present: AppState): HistoryState {
	return { present, past: [], future: [] }
}

function snapshotOf(state: AppState): DesignSnapshot {
	return {
		currentScheme: state.currentScheme,
		gridShape: state.gridShape,
		gridSizes: state.gridSizes,
		shapeGroupColors: state.shapeGroupColors,
		savedBoards: state.savedBoards,
	}
}

function sameDesign(previous: AppState, next: AppState): boolean {
	if (
		previous.gridShape !== next.gridShape ||
		supportedGridShapes.some(
			({ id }) => previous.gridSizes[id] !== next.gridSizes[id],
		) ||
		previous.currentScheme.name !== next.currentScheme.name ||
		!previous.currentScheme.colors.every(
			(color, index) => color === next.currentScheme.colors[index],
		)
	) {
		return false
	}
	if (!samePaint(previous.shapeGroupColors, next.shapeGroupColors))
		return false
	if (previous.savedBoards === next.savedBoards) return true
	const previousBoards = Object.keys(previous.savedBoards)
	const nextBoards: Readonly<Record<string, PaintMap | undefined>> =
		next.savedBoards
	return (
		previousBoards.length === Object.keys(nextBoards).length &&
		Object.entries(previous.savedBoards).every(([id, paint]) => {
			const nextPaint = nextBoards[id]
			return nextPaint !== undefined && samePaint(paint, nextPaint)
		})
	)
}

function samePaint(previous: PaintMap, next: PaintMap): boolean {
	if (previous === next) return true
	const ids = Object.keys(previous)
	return (
		ids.length === Object.keys(next).length &&
		ids.every(id => Object.hasOwn(next, id) && previous[id] === next[id])
	)
}

function applySnapshot(state: AppState, snapshot: DesignSnapshot): AppState {
	let currentColor = state.currentColor
	const { base, accent } = getThemeColors(state.darkMode)
	if (
		currentColor !== base &&
		currentColor !== accent &&
		!snapshot.currentScheme.colors.includes(currentColor)
	) {
		const colorIndex = state.currentScheme.colors.indexOf(currentColor)
		if (colorIndex !== -1) {
			currentColor = snapshot.currentScheme.colors[colorIndex]
		}
	}
	return { ...state, ...snapshot, currentColor }
}

export function historyReducer(
	history: HistoryState,
	action: HistoryAction,
): HistoryState {
	if (action.type === 'UNDO') {
		if (history.past.length === 0) return history
		const previous = history.past[history.past.length - 1]
		return {
			present: applySnapshot(history.present, previous),
			past: history.past.slice(0, -1),
			future: [snapshotOf(history.present), ...history.future],
		}
	}

	if (action.type === 'REDO') {
		if (history.future.length === 0) return history
		const [next, ...rest] = history.future
		return {
			present: applySnapshot(history.present, next),
			past: [...history.past, snapshotOf(history.present)],
			future: rest,
		}
	}

	const present = appReducer(history.present, action)
	if (present === history.present) return history

	if (!UNDOABLE_ACTION_TYPES.has(action.type)) {
		// Still applies (e.g. dark mode remapping), just isn't a stop on the
		// undo/redo stack.
		return { ...history, present }
	}

	if (sameDesign(history.present, present)) {
		// Reselecting a scheme can reset the paint tool without changing the design.
		if (
			present.currentColor === history.present.currentColor &&
			present.darkMode === history.present.darkMode &&
			present.showEditableArea === history.present.showEditableArea
		) {
			return history
		}
		return { ...history, present }
	}

	return {
		present,
		past: [...history.past, snapshotOf(history.present)],
		future: [],
	}
}
