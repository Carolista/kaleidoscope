import { beforeEach, describe, expect, it, vi } from 'vitest'
import { palettes, testContent } from '@/test/playerContent'
import {
	supportedGridShapes,
	defaultGridSizes,
	legacyGridSizes,
} from '@/domain/shapes'
import type { ZenState } from './zenState'
import { zenReducer } from './zenReducer'
import {
	loadInitialZenState as loadWithContent,
	savePersistedState,
	hasPersistedDesign,
} from './storageService'

const loadInitialZenState = () => loadWithContent(testContent)

const STORAGE_KEY = 'kaleidoscope:design'

function baseState(overrides: Partial<ZenState> = {}): ZenState {
	return {
		currentPalette: palettes[0],
		currentColor: palettes[0].colors[0],
		darkMode: false,
		showEditableArea: true,
		gridShape: 'hexagon',
		gridSizes: { ...defaultGridSizes },
		savedBoards: {},
		shapeGroupColors: {},
		...overrides,
	}
}

describe('storageService', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('round-trips all 18 boards and restores each board after reload', () => {
		let saved = baseState()
		const boards = supportedGridShapes.flatMap(({ id }) =>
			(['sm', 'md', 'lg'] as const).map(size => ({ shape: id, size })),
		)
		boards.forEach(({ shape, size }, index) => {
			saved = zenReducer(saved, {
				type: 'SELECT_GRID_SHAPE',
				shape,
				size,
			})
			saved = zenReducer(saved, {
				type: 'SELECT_COLOR',
				color: `#${index.toString(16).padStart(6, '0')}`,
			})
			saved = zenReducer(saved, {
				type: 'PAINT_SHAPE_GROUP',
				groupId: '0',
			})
		})
		savePersistedState(saved)
		let restored = loadInitialZenState()
		expect(restored).toEqual(saved)
		boards.forEach(({ shape, size }, index) => {
			restored = zenReducer(restored, {
				type: 'SELECT_GRID_SHAPE',
				shape,
				size,
			})
			expect(restored.shapeGroupColors).toEqual({
				'0': `#${index.toString(16).padStart(6, '0')}`,
			})
		})
	})

	it.each([1, 2, 3, 4])(
		'migrates version %s active paint without copying it to other boards',
		version => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					version,
					schemeName: palettes[0].name,
					currentColor: '#123456',
					darkMode: false,
					gridShape: 'triangle',
					gridSizes: { ...defaultGridSizes, triangle: 'sm' },
					shapeGroupColors: { '0': '#123456' },
				}),
			)
			const restored = loadInitialZenState()
			expect(restored.shapeGroupColors).toEqual({ '0': '#123456' })
			expect(restored.savedBoards).toEqual({})
			const switched = zenReducer(restored, {
				type: 'SELECT_GRID_SIZE',
				shape: 'triangle',
				size: 'md',
			})
			expect(switched.shapeGroupColors).toEqual({})
			expect(switched.savedBoards['triangle:sm']).toEqual({
				'0': '#123456',
			})
		},
	)

	it.each([
		null,
		[],
		{ 'unknown:sm': {} },
		{ 'triangle:xl': {} },
		{ 'triangle:sm': [] },
		{ 'triangle:sm': { a: 'red' } },
		{ 'hexagon:md': {} },
	])('rejects invalid version-5 inactive boards %j', savedBoards => {
		savePersistedState(baseState())
		const payload = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
		payload.savedBoards = savedBoards
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
		expect(loadInitialZenState().savedBoards).toEqual({})
		expect(loadInitialZenState().darkMode).toBe(true)
	})

	it('saves the palette by ID and restores it from the current palettes', () => {
		savePersistedState(
			baseState({
				currentPalette: palettes[2],
				currentColor: palettes[2].colors[0],
			}),
		)
		const payload = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
		expect(payload).toMatchObject({ version: 6, paletteId: 'club-neon' })
		expect(payload).not.toHaveProperty('schemeName')
		const corrected = { ...palettes[2], colors: palettes[3].colors }
		const restored = loadWithContent({
			...testContent,
			palettes: [palettes[0], corrected],
		})
		expect(restored.currentPalette).toBe(corrected)
	})

	it('still restores designs saved by palette name before palettes had IDs', () => {
		savePersistedState(baseState({ currentPalette: palettes[1] }))
		const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
		delete legacy.paletteId
		legacy.schemeName = palettes[1].name
		legacy.version = 5
		localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))
		expect(loadInitialZenState().currentPalette).toBe(palettes[1])
	})

	it('starts fresh when the saved palette is no longer available', () => {
		savePersistedState(
			baseState({
				currentPalette: palettes[2],
				shapeGroupColors: { '0': palettes[2].colors[0] },
			}),
		)
		const state = loadWithContent({
			...testContent,
			palettes: palettes.slice(0, 2),
		})
		expect(state.currentPalette).toBe(palettes[0])
		expect(state.shapeGroupColors).toEqual({})
	})

	it('starts fresh on the first unlocked shape when the saved shape is locked', () => {
		savePersistedState(
			baseState({
				gridShape: 'triangle',
				shapeGroupColors: { '0': palettes[0].colors[0] },
			}),
		)
		const state = loadWithContent({
			...testContent,
			unlockedShapes: ['hexagon'],
		})
		expect(state.gridShape).toBe('hexagon')
		expect(state.shapeGroupColors).toEqual({})
		expect(loadInitialZenState().gridShape).toBe('triangle')
	})

	it('loadInitialZenState falls back to a fresh random state when nothing is saved', () => {
		const state = loadInitialZenState()
		expect(palettes).toContain(state.currentPalette)
		expect(state.shapeGroupColors).toEqual({})
	})

	it('round-trips a saved design back through loadInitialZenState', () => {
		const saved = baseState({
			currentPalette: palettes[2],
			currentColor: palettes[2].colors[1],
			darkMode: true,
			gridShape: 'triangle',
			shapeGroupColors: { '0,0': palettes[2].colors[1] },
		})
		savePersistedState(saved)

		const loaded = loadInitialZenState()
		expect(loaded).toEqual(saved)
	})

	it.each(supportedGridShapes)('restores supported shape $id', ({ id }) => {
		const saved = baseState({ gridShape: id })
		savePersistedState(saved)
		expect(loadInitialZenState()).toEqual(saved)
	})

	it.each(['#000000', '#ffffff', '#ABCDEF', '#aB12Cd'])(
		'preserves valid six-digit hex color %s without normalization or palette restrictions',
		color => {
			const saved = baseState({
				currentColor: color,
				shapeGroupColors: { 'historical-group-id': color },
			})
			savePersistedState(saved)
			expect(loadInitialZenState()).toEqual(saved)
		},
	)

	it.each([
		undefined,
		null,
		123,
		{},
		[],
		'',
		'red',
		'transparent',
		'#abc',
		'#abcd',
		'#12345678',
		'123456',
		'#12345g',
		' #123456',
		'#123456 ',
		'#123456\n',
		'rgb(1, 2, 3)',
		'url(#paint)',
	])('rejects invalid selected or painted color %j', color => {
		for (const overrides of [
			{ currentColor: color },
			{ shapeGroupColors: { valid: '#123456', invalid: color } },
		]) {
			// JSON omits undefined properties, so a missing paint value cannot be invalid.
			if (color === undefined && 'shapeGroupColors' in overrides) continue
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					version: 1,
					schemeName: palettes[0].name,
					currentColor: '#123456',
					darkMode: false,
					showEditableArea: false,
					gridShape: 'triangle',
					shapeGroupColors: { valid: '#123456' },
					...overrides,
				}),
			)
			const state = loadInitialZenState()
			expect(state).toEqual({
				currentPalette: state.currentPalette,
				currentColor: state.currentPalette.colors[0],
				darkMode: true,
				showEditableArea: true,
				gridShape: 'hexagon',
				gridSizes: { ...defaultGridSizes },
				savedBoards: {},
				shapeGroupColors: {},
			})
			expect(palettes).toContain(state.currentPalette)
		}
	})

	it.each([
		undefined,
		null,
		[],
		['#123456'],
		['#123456', '#abcdef'],
		123,
		'#123456',
	])('rejects malformed paint map %j', shapeGroupColors => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: palettes[0].name,
				currentColor: '#123456',
				darkMode: false,
				shapeGroupColors,
			}),
		)
		const state = loadInitialZenState()
		expect(state.darkMode).toBe(true)
		expect(state.currentColor).toBe(state.currentPalette.colors[0])
		expect(state.shapeGroupColors).toEqual({})
	})

	it.each([null, [], ['#123456'], 123, 'design'])(
		'rejects non-record payload %j without changing the saved-key existence policy',
		payload => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
			expect(loadInitialZenState().shapeGroupColors).toEqual({})
			expect(hasPersistedDesign()).toBe(true)
		},
	)

	it('restores historical designs with both optional fields missing and valid painted colors', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: palettes[0].name,
				currentColor: '#ABCDEF',
				darkMode: false,
				shapeGroupColors: { a: '#123456' },
			}),
		)
		expect(loadInitialZenState()).toEqual(
			baseState({
				currentColor: '#ABCDEF',
				gridSizes: { ...defaultGridSizes, hexagon: 'lg' },
				shapeGroupColors: { a: '#123456' },
			}),
		)
	})

	it('round-trips per-shape grid sizes and migrates old saved designs to their previous active size', () => {
		const saved = baseState({
			gridSizes: {
				...defaultGridSizes,
				hexagon: 'lg',
				hexagram: 'md',
			},
		})
		savePersistedState(saved)
		expect(loadInitialZenState()).toEqual(saved)

		const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<
			string,
			unknown
		>
		delete legacy.gridSizes
		legacy.version = 4
		legacy.gridShape = 'triangle'
		localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))
		expect(loadInitialZenState().gridSizes).toEqual({
			...defaultGridSizes,
			triangle: legacyGridSizes.triangle,
		})
	})

	it('migrates pre-Hexagram-size saved MD values to LG to preserve the old rendered size', () => {
		const previouslySaved = baseState({
			gridSizes: { ...defaultGridSizes, hexagram: 'md' },
		})
		savePersistedState(previouslySaved)
		const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<
			string,
			unknown
		>
		legacy.version = 1
		localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

		expect(loadInitialZenState().gridSizes.hexagram).toBe('lg')
	})

	it.each([{ hexagon: 'extra-large' }, { pinwheel: 'xl' }])(
		'rejects invalid or unavailable persisted grid sizes',
		gridSizes => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					version: 1,
					schemeName: palettes[0].name,
					currentColor: '#123456',
					darkMode: false,
					gridSizes,
					shapeGroupColors: {},
				}),
			)
			expect(loadInitialZenState().gridSizes).toEqual(defaultGridSizes)
		},
	)

	it('migrates pre-Circle-Rings-size MD values to LG to preserve the previous grid', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 2,
				schemeName: palettes[0].name,
				currentColor: '#123456',
				darkMode: false,
				gridShape: 'circleRings',
				gridSizes: { ...defaultGridSizes, circleRings: 'md' },
				shapeGroupColors: {},
			}),
		)

		expect(loadInitialZenState().gridSizes.circleRings).toBe('lg')
	})

	it('migrates pre-Pinwheel-size MD values to LG to preserve the previous grid', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 3,
				schemeName: palettes[0].name,
				currentColor: '#123456',
				darkMode: false,
				gridShape: 'pinwheel',
				gridSizes: { ...defaultGridSizes, pinwheel: 'md' },
				shapeGroupColors: {},
			}),
		)

		expect(loadInitialZenState().gridSizes.pinwheel).toBe('lg')
	})

	it('falls back to a fresh random state when the saved palette name no longer exists', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: 'Not A Real Palette',
				currentColor: '#123456',
				darkMode: true,
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialZenState()
		expect(palettes).toContain(state.currentPalette)
	})

	it('falls back to a fresh random state on corrupted JSON', () => {
		localStorage.setItem(STORAGE_KEY, '{ not valid json')
		const state = loadInitialZenState()
		expect(palettes).toContain(state.currentPalette)
	})

	it('falls back to a fresh random state when the saved version is unrecognized', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 999,
				schemeName: palettes[0].name,
				currentColor: palettes[0].colors[0],
				darkMode: false,
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialZenState()
		expect(palettes).toContain(state.currentPalette)
	})

	it('falls back to a fresh random state when shapeGroupColors has non-string values', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: palettes[0].name,
				currentColor: palettes[0].colors[0],
				darkMode: false,
				shapeGroupColors: { a: 123 },
			}),
		)
		const state = loadInitialZenState()
		expect(palettes).toContain(state.currentPalette)
		expect(state.shapeGroupColors).toEqual({})
	})

	it('defaults showEditableArea to true when loading a design saved before that field existed', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: palettes[0].name,
				currentColor: palettes[0].colors[0],
				darkMode: false,
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialZenState()
		expect(state.showEditableArea).toBe(true)
	})

	it('falls back to a fresh random state when showEditableArea is present but not a boolean', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: palettes[0].name,
				currentColor: palettes[0].colors[0],
				darkMode: false,
				showEditableArea: 'yes',
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialZenState()
		expect(palettes).toContain(state.currentPalette)
	})

	it('defaults gridShape to hexagon when loading a design saved before that field existed', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: palettes[0].name,
				currentColor: palettes[0].colors[0],
				darkMode: false,
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialZenState()
		expect(state.gridShape).toBe('hexagon')
	})

	it('falls back to a fresh random state when gridShape is present but not a recognized shape', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: 1,
				schemeName: palettes[0].name,
				currentColor: palettes[0].colors[0],
				darkMode: false,
				gridShape: 'octagon',
				shapeGroupColors: {},
			}),
		)
		const state = loadInitialZenState()
		expect(palettes).toContain(state.currentPalette)
	})

	it('savePersistedState swallows storage errors instead of throwing', () => {
		const setItemSpy = vi
			.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(() => {
				throw new Error('quota exceeded')
			})
		expect(() => savePersistedState(baseState())).not.toThrow()
		setItemSpy.mockRestore()
	})

	it('loadInitialZenState swallows storage access errors instead of throwing', () => {
		const getItemSpy = vi
			.spyOn(Storage.prototype, 'getItem')
			.mockImplementation(() => {
				throw new Error('storage disabled')
			})
		expect(() => loadInitialZenState()).not.toThrow()
		getItemSpy.mockRestore()
	})

	it('hasPersistedDesign is false when nothing has been saved', () => {
		expect(hasPersistedDesign()).toBe(false)
	})

	it('hasPersistedDesign is true once a design has been saved', () => {
		savePersistedState(baseState())
		expect(hasPersistedDesign()).toBe(true)
	})

	it('hasPersistedDesign swallows storage access errors instead of throwing', () => {
		const getItemSpy = vi
			.spyOn(Storage.prototype, 'getItem')
			.mockImplementation(() => {
				throw new Error('storage disabled')
			})
		expect(() => hasPersistedDesign()).not.toThrow()
		expect(hasPersistedDesign()).toBe(false)
		getItemSpy.mockRestore()
	})
})
