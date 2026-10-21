import { describe, expect, it } from 'vitest'
import {
	groupAcceptsPuzzle,
	isPaletteGroupPurpose,
	isPuzzleGroupPurpose,
	isPuzzleGroupTrack,
	purposeHasShape,
	recipesForTrack,
	trackForPurpose,
	tracksForPurpose,
} from './groupDetails'

describe('group purposes and tracks', () => {
	it('recognizes only the supported purposes and tracks', () => {
		expect(isPuzzleGroupPurpose('daily')).toBe(true)
		expect(isPuzzleGroupPurpose('paid')).toBe(false)
		expect(isPaletteGroupPurpose('pack')).toBe(true)
		expect(isPaletteGroupPurpose('daily')).toBe(false)
		expect(isPuzzleGroupTrack('mixed')).toBe(true)
		expect(isPuzzleGroupTrack('hard')).toBe(false)
	})

	it('gives every purpose except daily a shape', () => {
		for (const purpose of ['undecided', 'core', 'reward', 'pack'])
			expect(purposeHasShape(purpose)).toBe(true)
		expect(purposeHasShape('daily')).toBe(false)
	})

	it('limits tracks by purpose', () => {
		expect(tracksForPurpose('core')).toEqual(['basic', 'rotation'])
		expect(tracksForPurpose('reward')).toEqual(['basic', 'rotation'])
		expect(tracksForPurpose('pack')).toEqual(['basic', 'rotation', 'mixed'])
		expect(tracksForPurpose('daily')).toEqual([])
		expect(tracksForPurpose('undecided')).toEqual([])
	})

	it('keeps a still-valid track and otherwise picks the first allowed one', () => {
		expect(trackForPurpose('pack', 'mixed')).toBe('mixed')
		expect(trackForPurpose('core', 'mixed')).toBe('basic')
		expect(trackForPurpose('core', 'rotation')).toBe('rotation')
		expect(trackForPurpose('daily', 'basic')).toBeNull()
		expect(trackForPurpose('undecided', null)).toBeNull()
	})

	it.each([
		[{ shape_id: 'hexagon', track: 'basic' }, 'hexagon', false, true],
		[{ shape_id: 'hexagon', track: 'basic' }, 'hexagon', true, false],
		[{ shape_id: 'hexagon', track: 'rotation' }, 'hexagon', true, true],
		[{ shape_id: 'hexagon', track: 'rotation' }, 'hexagon', false, false],
		[{ shape_id: 'hexagon', track: 'mixed' }, 'hexagon', true, true],
		[{ shape_id: 'hexagon', track: 'mixed' }, 'hexagon', false, true],
		[{ shape_id: 'hexagon', track: null }, 'triangle', false, false],
		[{ shape_id: null, track: null }, 'pinwheel', true, true],
		[{ shape_id: null, track: null }, 'hexagon', false, true],
	])(
		'matches the database rule for %j with a %s puzzle (rotation %s)',
		(group, shape, rotation, accepted) => {
			expect(
				groupAcceptsPuzzle(group, {
					shape_id: shape,
					rotation_allowed: rotation,
				}),
			).toBe(accepted)
		},
	)

	it('offers only matching recipes for a track', () => {
		expect(recipesForTrack('basic').every(recipe => !recipe.rotation)).toBe(
			true,
		)
		expect(
			recipesForTrack('rotation').every(recipe => recipe.rotation),
		).toBe(true)
		expect(recipesForTrack('basic').length).toBeGreaterThan(0)
		expect(recipesForTrack('rotation').length).toBeGreaterThan(0)
		expect(recipesForTrack('mixed')).toEqual(recipesForTrack(null))
		expect(recipesForTrack(null).length).toBe(
			recipesForTrack('basic').length +
				recipesForTrack('rotation').length,
		)
	})
})
