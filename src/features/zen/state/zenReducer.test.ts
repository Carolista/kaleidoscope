import { describe, expect, it } from 'vitest'
import { palettes } from '@/domain/palettes'
import {
	defaultGridSizes,
	supportedGridShapes,
	getGroupIdsForShape,
} from '@/domain/shapes'
import { zenReducer, createInitialZenState } from './zenReducer'
import type { ZenState } from './zenState'

describe('createInitialZenState', () => {
	it('uses the first palette and defaults current color to its first color', () => {
		const state = createInitialZenState()
		expect(state.currentPalette).toBe(palettes[0])
		expect(state.currentColor).toBe(palettes[0].colors[0])
		expect(state.darkMode).toBe(true)
		expect(state.showEditableArea).toBe(true)
		expect(state.gridShape).toBe('hexagon')
		expect(state.gridSizes).toEqual(defaultGridSizes)
		expect(state.shapeGroupColors).toEqual({})
	})
})

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

describe('zenReducer', () => {
	it('restores independent paint on every one of the 18 boards without changing theme or palette', () => {
		let state = baseState()
		const boards = supportedGridShapes.flatMap(({ id }) =>
			(['sm', 'md', 'lg'] as const).map(size => ({ shape: id, size })),
		)
		boards.forEach(({ shape, size }, index) => {
			state = zenReducer(state, {
				type: 'SELECT_GRID_SHAPE',
				shape,
				size,
			})
			expect(state.shapeGroupColors).toEqual({})
			state = zenReducer(state, {
				type: 'SELECT_COLOR',
				color: `#${index.toString(16).padStart(6, '0')}`,
			})
			state = zenReducer(state, {
				type: 'PAINT_SHAPE_GROUP',
				groupId: '0',
			})
		})
		boards.forEach(({ shape, size }, index) => {
			state = zenReducer(state, {
				type: 'SELECT_GRID_SHAPE',
				shape,
				size,
			})
			expect(state.shapeGroupColors).toEqual({
				'0': `#${index.toString(16).padStart(6, '0')}`,
			})
			expect(state.darkMode).toBe(false)
			expect(state.currentPalette).toBe(palettes[0])
		})
		expect(Object.keys(state.savedBoards)).toHaveLength(17)
	})

	it('remaps palette colors and explicit theme toggles on inactive boards as well', () => {
		const state = baseState({
			shapeGroupColors: { a: palettes[0].colors[1] },
			savedBoards: {
				'triangle:sm': {
					a: palettes[0].colors[2],
					b: '#ffffff',
					c: '#222222',
					d: '#abcdef',
				},
			},
		})
		const changed = zenReducer(state, {
			type: 'SELECT_PALETTE',
			palette: palettes[1],
		})
		expect(changed.savedBoards['triangle:sm']).toEqual({
			a: palettes[1].colors[2],
			b: '#ffffff',
			c: '#222222',
			d: '#abcdef',
		})
		expect(changed.darkMode).toBe(false)
		const toggled = zenReducer(changed, { type: 'TOGGLE_DARK_MODE' })
		expect(toggled.savedBoards['triangle:sm']).toEqual({
			a: palettes[1].colors[2],
			b: '#222222',
			c: '#ffffff',
			d: '#abcdef',
		})
	})

	it('reset and randomize affect only the active board', () => {
		const state = baseState({
			shapeGroupColors: { a: '#abcdef' },
			savedBoards: { 'triangle:sm': { b: '#123456' } },
		})
		expect(zenReducer(state, { type: 'RESET_DESIGN' }).savedBoards).toBe(
			state.savedBoards,
		)
		expect(
			zenReducer(state, { type: 'RANDOMIZE_DESIGN' }).savedBoards,
		).toBe(state.savedBoards)
	})

	it('SELECT_PALETTE switches palette and resets current color to its first color', () => {
		const state = baseState({ currentColor: '#abcdef' })
		const next = zenReducer(state, {
			type: 'SELECT_PALETTE',
			palette: palettes[3],
		})
		expect(next.currentPalette).toBe(palettes[3])
		expect(next.currentColor).toBe(palettes[3].colors[0])
	})

	it('SELECT_PALETTE remaps painted groups with an old-palette color to the new palette color at the same position', () => {
		const oldPalette = palettes[0]
		const newPalette = palettes[1]
		const state = baseState({
			currentPalette: oldPalette,
			shapeGroupColors: {
				a: oldPalette.colors[0],
				b: oldPalette.colors[2],
			},
		})
		const next = zenReducer(state, {
			type: 'SELECT_PALETTE',
			palette: newPalette,
		})
		expect(next.shapeGroupColors).toEqual({
			a: newPalette.colors[0],
			b: newPalette.colors[2],
		})
	})

	it('SELECT_PALETTE leaves painted groups with base/accent (or any non-palette color) untouched', () => {
		const oldPalette = palettes[0]
		const newPalette = palettes[1]
		const state = baseState({
			currentPalette: oldPalette,
			shapeGroupColors: { a: '#222222', b: '#ffffff' },
		})
		const next = zenReducer(state, {
			type: 'SELECT_PALETTE',
			palette: newPalette,
		})
		expect(next.shapeGroupColors).toEqual({ a: '#222222', b: '#ffffff' })
	})

	it('SELECT_COLOR sets the current color directly', () => {
		const state = baseState()
		const next = zenReducer(state, {
			type: 'SELECT_COLOR',
			color: '#123456',
		})
		expect(next.currentColor).toBe('#123456')
	})

	it('SELECT_COLOR preserves the state reference for the already-selected color', () => {
		const state = baseState()
		expect(
			zenReducer(state, {
				type: 'SELECT_COLOR',
				color: state.currentColor,
			}),
		).toBe(state)
	})

	it.each([false, true])(
		'painting accent onto default or explicit accent is a no-op in dark mode %s',
		darkMode => {
			const accent = darkMode ? '#ffffff' : '#222222'
			const paintMaps: ZenState['shapeGroupColors'][] = [
				{},
				{ a: accent },
			]
			for (const shapeGroupColors of paintMaps) {
				const state = baseState({
					darkMode,
					currentColor: accent,
					shapeGroupColors,
				})
				expect(
					zenReducer(state, {
						type: 'PAINT_SHAPE_GROUP',
						groupId: 'a',
					}),
				).toBe(state)
			}
		},
	)

	it('PAINT_SHAPE_GROUP paints an unpainted group with the current color', () => {
		const state = baseState({ currentColor: '#ff0000' })
		const next = zenReducer(state, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		expect(next.shapeGroupColors['0,0']).toBe('#ff0000')
	})

	it('PAINT_SHAPE_GROUP toggles back to the accent color when clicking an already-painted group with the same color', () => {
		const state = baseState({
			currentColor: '#ff0000',
			shapeGroupColors: { '0,0': '#ff0000' },
		})
		const next = zenReducer(state, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		expect(next.shapeGroupColors['0,0']).toBe('#222222')
	})

	it('PAINT_SHAPE_GROUP repaints (not toggles) a group painted a different color', () => {
		const state = baseState({
			currentColor: '#00ff00',
			shapeGroupColors: { '0,0': '#ff0000' },
		})
		const next = zenReducer(state, {
			type: 'PAINT_SHAPE_GROUP',
			groupId: '0,0',
		})
		expect(next.shapeGroupColors['0,0']).toBe('#00ff00')
	})

	it('TOGGLE_DARK_MODE flips the darkMode flag', () => {
		const state = baseState({ darkMode: false })
		expect(zenReducer(state, { type: 'TOGGLE_DARK_MODE' }).darkMode).toBe(
			true,
		)
	})

	it('TOGGLE_DARK_MODE flips painted groups with the old base/accent to the new ones', () => {
		const state = baseState({
			darkMode: false,
			shapeGroupColors: { a: '#222222', b: '#ffffff', c: '#ff0000' },
		})
		const next = zenReducer(state, { type: 'TOGGLE_DARK_MODE' })
		expect(next.shapeGroupColors).toEqual({
			a: '#ffffff',
			b: '#222222',
			c: '#ff0000',
		})
	})

	it('RESET_DESIGN clears all painted groups', () => {
		const state = baseState({
			shapeGroupColors: { a: '#ff0000', b: '#00ff00' },
		})
		const next = zenReducer(state, { type: 'RESET_DESIGN' })
		expect(next.shapeGroupColors).toEqual({})
	})

	it('RESET_DESIGN preserves the state reference when already empty', () => {
		const state = baseState()
		expect(zenReducer(state, { type: 'RESET_DESIGN' })).toBe(state)
	})
	it('RANDOMIZE_DESIGN assigns every group id a color from the current palette or theme base (never accent)', () => {
		const state = baseState({ darkMode: false })
		const next = zenReducer(state, { type: 'RANDOMIZE_DESIGN' })
		const possible = new Set([
			...state.currentPalette.colors,
			'#ffffff', // light-mode base
		])
		const groupIds = Object.keys(next.shapeGroupColors)
		expect(groupIds.length).toBeGreaterThan(0)
		for (const color of Object.values(next.shapeGroupColors)) {
			expect(possible).toContain(color)
		}
	})

	it('RANDOMIZE_DESIGN replaces the entire design, discarding any previously painted groups', () => {
		const state = baseState({
			shapeGroupColors: { 'not-a-real-group-id': '#ff0000' },
		})
		const next = zenReducer(state, { type: 'RANDOMIZE_DESIGN' })
		expect(next.shapeGroupColors['not-a-real-group-id']).toBeUndefined()
	})

	it('TOGGLE_EDITABLE_AREA flips the showEditableArea flag', () => {
		const state = baseState({ showEditableArea: true })
		expect(
			zenReducer(state, { type: 'TOGGLE_EDITABLE_AREA' })
				.showEditableArea,
		).toBe(false)
		expect(
			zenReducer(baseState({ showEditableArea: false }), {
				type: 'TOGGLE_EDITABLE_AREA',
			}).showEditableArea,
		).toBe(true)
	})

	it('SELECT_GRID_SHAPE switches to an empty board and saves outgoing paint', () => {
		const state = baseState({
			gridShape: 'hexagon',
			shapeGroupColors: { '0,0': '#ff0000' },
		})
		const next = zenReducer(state, {
			type: 'SELECT_GRID_SHAPE',
			shape: 'triangle',
		})
		expect(next.gridShape).toBe('triangle')
		expect(next.shapeGroupColors).toEqual({})
		expect(next.savedBoards['hexagon:md']).toEqual(state.shapeGroupColors)
	})

	it('SELECT_GRID_SHAPE is a no-op (same state reference) when selecting the already-current shape', () => {
		const state = baseState({
			gridShape: 'hexagon',
			shapeGroupColors: { '0,0': '#ff0000' },
		})
		const next = zenReducer(state, {
			type: 'SELECT_GRID_SHAPE',
			shape: 'hexagon',
		})
		expect(next).toBe(state)
	})

	it('SELECT_GRID_SIZE saves the entire large hexagon independently of small', () => {
		const removedGroupId = getGroupIdsForShape('hexagon', 'lg').find(
			id => !getGroupIdsForShape('hexagon', 'sm').includes(id),
		)!
		const state = baseState({
			gridSizes: { ...defaultGridSizes, hexagon: 'lg' },
			shapeGroupColors: {
				'0,0': '#ff0000',
				[removedGroupId]: '#00ff00',
			},
		})
		const next = zenReducer(state, {
			type: 'SELECT_GRID_SIZE',
			shape: 'hexagon',
			size: 'sm',
		})
		expect(next.gridSizes.hexagon).toBe('sm')
		expect(next.shapeGroupColors).toEqual({})
		expect(next.savedBoards['hexagon:lg']).toEqual(state.shapeGroupColors)
	})

	it('SELECT_GRID_SIZE saves the entire large triangle independently of small', () => {
		const removedGroupId = getGroupIdsForShape('triangle', 'lg').find(
			id => !getGroupIdsForShape('triangle', 'sm').includes(id),
		)!
		const state = baseState({
			gridShape: 'triangle',
			gridSizes: { ...defaultGridSizes, triangle: 'lg' },
			shapeGroupColors: {
				'0': '#ff0000',
				[removedGroupId]: '#00ff00',
			},
		})
		const next = zenReducer(state, {
			type: 'SELECT_GRID_SIZE',
			shape: 'triangle',
			size: 'sm',
		})
		expect(next.gridSizes.triangle).toBe('sm')
		expect(next.shapeGroupColors).toEqual({})
		expect(next.savedBoards['triangle:lg']).toEqual(state.shapeGroupColors)
	})

	it('SELECT_GRID_SIZE saves the entire large Diamond Star independently of small', () => {
		const removedGroupId = getGroupIdsForShape('diamondStar', 'lg').find(
			id => !getGroupIdsForShape('diamondStar', 'sm').includes(id),
		)!
		const state = baseState({
			gridShape: 'diamondStar',
			gridSizes: { ...defaultGridSizes, diamondStar: 'lg' },
			shapeGroupColors: {
				'0': '#ff0000',
				[removedGroupId]: '#00ff00',
			},
		})
		const next = zenReducer(state, {
			type: 'SELECT_GRID_SIZE',
			shape: 'diamondStar',
			size: 'sm',
		})
		expect(next.gridSizes.diamondStar).toBe('sm')
		expect(next.shapeGroupColors).toEqual({})
		expect(next.savedBoards['diamondStar:lg']).toEqual(
			state.shapeGroupColors,
		)
	})

	it('SELECT_GRID_SIZE saves the entire large Hexagram independently of small', () => {
		const removedGroupId = getGroupIdsForShape('hexagram', 'lg').find(
			id => !getGroupIdsForShape('hexagram', 'sm').includes(id),
		)!
		const state = baseState({
			gridShape: 'hexagram',
			gridSizes: { ...defaultGridSizes, hexagram: 'lg' },
			shapeGroupColors: {
				'0': '#ff0000',
				[removedGroupId]: '#00ff00',
			},
		})
		const next = zenReducer(state, {
			type: 'SELECT_GRID_SIZE',
			shape: 'hexagram',
			size: 'sm',
		})
		expect(next.gridSizes.hexagram).toBe('sm')
		expect(next.shapeGroupColors).toEqual({})
		expect(next.savedBoards['hexagram:lg']).toEqual(state.shapeGroupColors)
	})

	it('SELECT_GRID_SIZE saves the entire large Circle Rings independently of small', () => {
		const smallGroupIds = getGroupIdsForShape('circleRings', 'sm')
		const largeGroupIds = getGroupIdsForShape('circleRings', 'lg')
		const retainedGroupId = largeGroupIds.find(id =>
			smallGroupIds.includes(id),
		)!
		const removedGroupId = largeGroupIds.find(
			id => !smallGroupIds.includes(id),
		)!
		const state = baseState({
			gridShape: 'circleRings',
			gridSizes: { ...defaultGridSizes, circleRings: 'lg' },
			shapeGroupColors: {
				[retainedGroupId]: '#ff0000',
				[removedGroupId]: '#00ff00',
			},
		})
		const next = zenReducer(state, {
			type: 'SELECT_GRID_SIZE',
			shape: 'circleRings',
			size: 'sm',
		})
		expect(next.gridSizes.circleRings).toBe('sm')
		expect(next.shapeGroupColors).toEqual({})
		expect(next.savedBoards['circleRings:lg']).toEqual(
			state.shapeGroupColors,
		)
	})

	it('SELECT_GRID_SIZE saves the entire large Pinwheel independently of small', () => {
		const smallGroupIds = getGroupIdsForShape('pinwheel', 'sm')
		const largeGroupIds = getGroupIdsForShape('pinwheel', 'lg')
		const retainedGroupId = largeGroupIds.find(id =>
			smallGroupIds.includes(id),
		)!
		const removedGroupId = largeGroupIds.find(
			id => !smallGroupIds.includes(id),
		)!
		const state = baseState({
			gridShape: 'pinwheel',
			gridSizes: { ...defaultGridSizes, pinwheel: 'lg' },
			shapeGroupColors: {
				[retainedGroupId]: '#ff0000',
				[removedGroupId]: '#00ff00',
			},
		})
		const next = zenReducer(state, {
			type: 'SELECT_GRID_SIZE',
			shape: 'pinwheel',
			size: 'sm',
		})
		expect(next.gridSizes.pinwheel).toBe('sm')
		expect(next.shapeGroupColors).toEqual({})
		expect(next.savedBoards['pinwheel:lg']).toEqual(state.shapeGroupColors)
	})

	it('SELECT_GRID_SIZE changes an available shape size', () => {
		const state = baseState()
		expect(
			zenReducer(state, {
				type: 'SELECT_GRID_SIZE',
				shape: 'hexagon',
				size: 'sm',
			}),
		).not.toBe(state)
	})
})
