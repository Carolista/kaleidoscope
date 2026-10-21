import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { loadShapePuzzleCounts } from './shapePuzzleCounts'

function clientWith(
	result: (shape: string) => { count: number | null; error: unknown },
) {
	const select = vi.fn(() => ({
		eq: (...[, shape]: [string, string]) => Promise.resolve(result(shape)),
	}))
	const from = vi.fn(() => ({ select }))
	return {
		client: { from } as unknown as SupabaseClient<Database>,
		from,
		select,
	}
}

describe('loadShapePuzzleCounts', () => {
	it('counts every puzzle of each shape, drafts included', async () => {
		const { client, from, select } = clientWith(shape => ({
			count: shape === 'hexagon' ? 12 : 0,
			error: null,
		}))
		expect(await loadShapePuzzleCounts(client)).toEqual({
			hexagon: 12,
			triangle: 0,
			diamondStar: 0,
			hexagram: 0,
			circleRings: 0,
			pinwheel: 0,
		})
		expect(from).toHaveBeenCalledWith('puzzles')
		expect(select).toHaveBeenCalledWith('id', {
			count: 'exact',
			head: true,
		})
	})

	it('reports a failed or missing count instead of treating it as zero', async () => {
		await expect(
			loadShapePuzzleCounts(
				clientWith(() => ({ count: null, error: { message: 'No' } }))
					.client,
			),
		).rejects.toThrow(/Unable to count hexagon puzzles: No/)
		await expect(
			loadShapePuzzleCounts(
				clientWith(() => ({ count: null, error: null })).client,
			),
		).rejects.toThrow(/count was not returned/)
	})
})
