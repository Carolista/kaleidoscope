import type { AppState } from '../types/appState'
import type { AppAction } from './appReducer'
import { appReducer } from './appReducer'

// Only the design content itself is undoable — picking a current color or
// toggling dark mode are just viewing/tool choices, not something a user
// would expect "undo" to step back through.
const UNDOABLE_ACTION_TYPES = new Set<AppAction['type']>([
	'SELECT_SCHEME',
	'PAINT_HEX_GROUP',
	'RESET_DESIGN',
	'RANDOMIZE_DESIGN',
	'SELECT_GRID_SHAPE',
])

type DesignSnapshot = Pick<
	AppState,
	'currentScheme' | 'gridShape' | 'hexGroupColors'
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
		hexGroupColors: state.hexGroupColors,
	}
}

function applySnapshot(state: AppState, snapshot: DesignSnapshot): AppState {
	return { ...state, ...snapshot }
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

	if (!UNDOABLE_ACTION_TYPES.has(action.type)) {
		// Still applies (e.g. dark mode remapping), just isn't a stop on the
		// undo/redo stack.
		return { ...history, present }
	}

	return {
		present,
		past: [...history.past, snapshotOf(history.present)],
		future: [],
	}
}
