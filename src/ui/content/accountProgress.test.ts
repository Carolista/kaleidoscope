import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/supabase'
import { supabaseAccountProgress } from './accountProgress'

describe('supabaseAccountProgress', () => {
	it("reads only the named player's solves, in pages", async () => {
		const filters: [string, unknown][] = []
		const rows = Array.from({ length: 1500 }, (_, index) => ({
			puzzle_id: `p${index}`,
		}))
		const client = {
			from(table: string) {
				expect(table).toBe('puzzle_completions')
				const query = {
					select: () => query,
					eq: (column: string, value: unknown) => {
						filters.push([column, value])
						return query
					},
					order: () => query,
					range: (from: number, to: number) =>
						Promise.resolve({
							data: rows.slice(from, to + 1),
							error: null,
						}),
				}
				return query
			},
		} as unknown as SupabaseClient<Database>

		const solved =
			await supabaseAccountProgress(client).loadSolved('user-1')
		expect(solved).toHaveLength(1500)
		expect(filters).toEqual([
			['user_id', 'user-1'],
			['user_id', 'user-1'],
		])
	})
})
