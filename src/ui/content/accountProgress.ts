import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

// What the player app needs from the server about a signed-in player's solved puzzles.
// Reads name the player: an admin's session can read every account's rows, so what the
// row-level rules allow is not enough to mean "mine".
export interface AccountProgressApi {
	readonly loadSolved: (userId: string) => Promise<string[]>
	// Resolves with the puzzles the server recorded (it skips any the player may not
	// play). Rejects when the server could not be reached or refused, so the caller can retry.
	readonly record: (puzzleIds: readonly string[]) => Promise<string[]>
}

const PAGE = 1000
// The server's limit per call. A bonus group's puzzles are only accepted once its core
// group is, which a single call settles, so batches should stay as large as allowed.
const BATCH = 2000

export function supabaseAccountProgress(
	client: SupabaseClient<Database>,
): AccountProgressApi {
	return {
		async loadSolved(userId) {
			const solved: string[] = []
			for (let from = 0; ; from += PAGE) {
				const { data, error } = await client
					.from('puzzle_completions')
					.select('puzzle_id')
					.eq('user_id', userId)
					.order('puzzle_id')
					.range(from, from + PAGE - 1)
				if (error) throw new Error(error.message)
				solved.push(...data.map(row => row.puzzle_id))
				if (data.length < PAGE) return solved
			}
		},
		async record(puzzleIds) {
			const recorded: string[] = []
			for (let start = 0; start < puzzleIds.length; start += BATCH) {
				const { data, error } = await client.rpc(
					'record_puzzle_completions',
					{
						p_puzzle_ids: puzzleIds.slice(start, start + BATCH),
					},
				)
				if (error) throw new Error(error.message)
				recorded.push(...data)
			}
			return recorded
		},
	}
}
