import type { SupabaseClient } from '@supabase/supabase-js'
import { PUZZLE_SHAPE_IDS, type PuzzleShapeId } from '@/domain/puzzles'
import type { Database } from '@/lib/supabase'

export type ShapePuzzleCounts = Readonly<Record<PuzzleShapeId, number>>

// Every puzzle counts, drafts included: once a shape has any, its grid sizes
// and piece mixes can no longer change underneath them.
export async function loadShapePuzzleCounts(
	client: SupabaseClient<Database>,
): Promise<ShapePuzzleCounts> {
	const counts = await Promise.all(
		PUZZLE_SHAPE_IDS.map(async id => {
			const { count, error } = await client
				.from('puzzles')
				.select('id', { count: 'exact', head: true })
				.eq('shape_id', id)
			if (error)
				throw new Error(
					`Unable to count ${id} puzzles: ${error.message}`,
				)
			if (typeof count !== 'number')
				throw new Error(`The ${id} puzzle count was not returned.`)
			return [id, count] as const
		}),
	)
	return Object.fromEntries(counts) as ShapePuzzleCounts
}
