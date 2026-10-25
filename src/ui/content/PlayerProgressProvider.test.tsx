import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { palettes, testContent } from '@/test/playerContent'
import { generatePuzzle } from '@/domain/puzzles'
import type { AccountProgressApi } from './accountProgress'
import type { PlayerContent, PlayerPuzzleSet } from './playerContent'
import { usePlayerContent } from './PlayerContentContext'
import { usePlayerProgress } from './PlayerProgressContext'
import {
	PlayerProgressProvider,
	type AccountSnapshot,
} from './PlayerProgressProvider'
import {
	loadAccountProgressCache,
	loadSolvedPuzzles,
	saveAccountProgressCache,
} from './solvedPuzzles'
import type { NewRewards } from './rewards'

function set(
	id: string,
	kind: PlayerPuzzleSet['kind'],
	puzzleIds: readonly string[],
): PlayerPuzzleSet {
	return {
		id,
		name: id,
		shape: 'hexagon',
		track: 'basic',
		kind,
		puzzles: puzzleIds.map(puzzleId => ({
			id: puzzleId,
			name: puzzleId,
			difficulty: 'easy',
			palette: palettes[1],
			puzzle: generatePuzzle(puzzleId, palettes[1]),
		})),
	}
}

const core = set('core', 'core', ['c1', 'c2'])
const bonus = set('bonus', 'bonus', ['b1'])
// What the player's own session can read before and after the server records the core set.
const before: PlayerContent = {
	...testContent,
	palettes: palettes.slice(0, 2),
	puzzleSets: [core],
	rewards: [{ setId: 'core', palettes: [], bonusSetIds: [] }],
}
const after: PlayerContent = {
	...before,
	puzzleSets: [core, bonus],
	rewards: [{ setId: 'core', palettes: [], bonusSetIds: ['bonus'] }],
}

let progress: ReturnType<typeof usePlayerProgress>
let sets: readonly string[]

function Probe() {
	const current = usePlayerProgress()
	const available = usePlayerContent().puzzleSets.map(item => item.id)
	useEffect(() => {
		progress = current
		sets = available
	})
	return null
}

function api(
	record: AccountProgressApi['record'] = () => Promise.resolve([]),
): AccountProgressApi {
	return { loadSolved: () => Promise.resolve([]), record }
}

function renderAccount(
	options: {
		readonly api?: AccountProgressApi
		readonly reload?: () => Promise<AccountSnapshot | null>
		readonly solved?: readonly string[]
		readonly userId?: string
	} = {},
) {
	const reload = options.reload ?? (() => Promise.resolve(null))
	const userId = options.userId ?? 'user-1'
	return render(
		<PlayerProgressProvider
			content={before}
			account={{
				userId,
				solved: options.solved ?? [],
				api: options.api ?? api(),
				reload,
			}}
		>
			<Probe />
		</PlayerProgressProvider>,
	)
}

beforeEach(() => localStorage.clear())

describe('PlayerProgressProvider for a guest', () => {
	it('keeps solves on the device and reports what they earn', async () => {
		render(
			<PlayerProgressProvider
				content={{
					...before,
					rewards: [
						{
							setId: 'core',
							palettes: [],
							bonusSetIds: [],
						},
					],
				}}
			>
				<Probe />
			</PlayerProgressProvider>,
		)
		let earned: NewRewards | undefined
		await act(async () => {
			await progress.markSolved('c1')
		})
		await act(async () => {
			earned = await progress.markSolved('c2')
		})
		expect(earned).toEqual({
			palettes: [],
			bonusSets: [],
			shapes: [],
			accountShape: null,
			randomizer: false,
		})
		expect([...loadSolvedPuzzles()]).toEqual(['c1', 'c2'])
		expect([...progress.solved]).toEqual(['c1', 'c2'])
	})
})

describe('PlayerProgressProvider account prompt', () => {
	it('names the locked shape when a guest finishes everything open to them', async () => {
		render(
			<PlayerProgressProvider
				content={{ ...before, nextShape: 'triangle' }}
			>
				<Probe />
			</PlayerProgressProvider>,
		)
		await act(async () => {
			await progress.markSolved('c1')
		})
		let earned: NewRewards | undefined
		await act(async () => {
			earned = await progress.markSolved('c2')
		})
		expect(earned?.accountShape).toBe('triangle')
	})
})

describe('PlayerProgressProvider guest import', () => {
	function guestSolved(...ids: string[]) {
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ids }),
		)
	}

	it('offers only the guest solves the account lacks, and imports them on request', async () => {
		guestSolved('g1', 'g2', 'c1')
		const record = vi.fn((ids: readonly string[]) =>
			Promise.resolve([...ids]),
		)
		const reload = vi.fn(() =>
			Promise.resolve({ content: before, solved: ['c1', 'g1', 'g2'] }),
		)
		renderAccount({ api: api(record), reload, solved: ['c1'] })
		expect(progress.guestImport).toMatchObject({
			count: 2,
			offered: true,
		})
		let done: boolean | undefined
		await act(async () => {
			done = await progress.guestImport?.run()
		})
		expect(done).toBe(true)
		expect(record).toHaveBeenCalledWith(['g1', 'g2'])
		expect(reload).toHaveBeenCalled()
		expect(progress.guestImport).toBeNull()
		expect([...progress.solved].sort()).toEqual(['c1', 'g1', 'g2'])
		expect([...loadSolvedPuzzles()].sort()).toEqual(['c1', 'g1', 'g2'])
		expect(
			JSON.parse(
				localStorage.getItem('kaleidoscope:guest-import:user-1') ??
					'{}',
			).handled.sort(),
		).toEqual(['g1', 'g2'])
	})

	it('offers solves made as a guest after an earlier import, and not the ones already sent', () => {
		guestSolved('g1', 'g-new')
		localStorage.setItem(
			'kaleidoscope:guest-import:user-1',
			JSON.stringify({ handled: ['g1'], declined: [] }),
		)
		renderAccount()
		expect(progress.guestImport).toMatchObject({
			count: 1,
			offered: true,
		})
	})

	it('does not reopen by itself for solves already declined, but does for new ones', () => {
		guestSolved('g1', 'g-new')
		localStorage.setItem(
			'kaleidoscope:guest-import:user-1',
			JSON.stringify({ handled: [], declined: ['g1'] }),
		)
		renderAccount()
		expect(progress.guestImport).toMatchObject({
			count: 2,
			offered: true,
		})
		guestSolved('g1')
		cleanup()
		renderAccount()
		expect(progress.guestImport).toMatchObject({
			count: 1,
			offered: false,
		})
	})

	it('ignores the earlier whole-save answers, so later guest solves are offered', () => {
		guestSolved('g1')
		for (const old of ['imported', 'declined']) {
			localStorage.setItem('kaleidoscope:guest-import:user-1', old)
			renderAccount()
			expect(progress.guestImport).toMatchObject({
				count: 1,
				offered: true,
			})
			cleanup()
		}
	})

	it('stays available when the server cannot take the import', async () => {
		guestSolved('g1')
		const record = vi.fn(() => Promise.reject(new Error('Offline')))
		renderAccount({ api: api(record) })
		let done: boolean | undefined
		await act(async () => {
			done = await progress.guestImport?.run()
		})
		expect(done).toBe(false)
		expect(progress.guestImport?.offered).toBe(true)
		expect(
			localStorage.getItem('kaleidoscope:guest-import:user-1'),
		).toBeNull()
	})

	it('has nothing to offer a guest, or an account with nothing new', () => {
		guestSolved('g1')
		render(
			<PlayerProgressProvider content={before}>
				<Probe />
			</PlayerProgressProvider>,
		)
		expect(progress.guestImport).toBeNull()
		renderAccount({ solved: ['g1'] })
		expect(progress.guestImport).toBeNull()
	})
})

describe('PlayerProgressProvider for an account', () => {
	it('records a solve on the account without touching the guest save', async () => {
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['guest-only'] }),
		)
		const record = vi.fn(() => Promise.resolve([] as string[]))
		renderAccount({ api: api(record), solved: ['c1'] })
		expect([...progress.solved]).toEqual(['c1'])
		await act(async () => {
			await progress.markSolved('c1-b')
		})
		await waitFor(() => expect(record).toHaveBeenCalledWith(['c1-b']))
		expect([...loadSolvedPuzzles()]).toEqual(['guest-only'])
		await waitFor(() =>
			expect(loadAccountProgressCache('user-1')).toEqual({
				solved: new Set(['c1', 'c1-b']),
				pending: new Set(),
			}),
		)
	})

	it('reloads when a set is finished and reports what the reloaded content opened', async () => {
		const reload = vi.fn(() =>
			Promise.resolve({ content: after, solved: ['c1', 'c2', 'x'] }),
		)
		renderAccount({ reload, solved: ['c1'] })
		let earned: NewRewards | undefined
		await act(async () => {
			earned = await progress.markSolved('c2')
		})
		expect(reload).toHaveBeenCalledOnce()
		expect(earned?.bonusSets.map(item => item.id)).toEqual(['bonus'])
		expect([...progress.solved].sort()).toEqual(['c1', 'c2', 'x'])
	})

	it('reports a shape the reloaded content opened, with its core sets', async () => {
		const triangle: PlayerPuzzleSet = {
			...set('tri', 'core', ['t1']),
			shape: 'triangle',
		}
		const opened: PlayerContent = {
			...after,
			unlockedShapes: ['hexagon', 'triangle'],
			puzzleSets: [core, bonus, triangle],
		}
		const locked = { ...before, unlockedShapes: ['hexagon' as const] }
		render(
			<PlayerProgressProvider
				content={locked}
				account={{
					userId: 'user-1',
					solved: ['c1'],
					api: api(),
					reload: () =>
						Promise.resolve({
							content: opened,
							solved: ['c1', 'c2'],
						}),
				}}
			>
				<Probe />
			</PlayerProgressProvider>,
		)
		let earned: NewRewards | undefined
		await act(async () => {
			earned = await progress.markSolved('c2')
		})
		expect(earned?.shapes).toEqual([
			{ shape: 'triangle', sets: [triangle] },
		])
	})

	it('reports the randomizer when the reloaded content has earned it', async () => {
		const earned: PlayerContent = { ...after, randomizerUnlocked: true }
		render(
			<PlayerProgressProvider
				content={{ ...before, randomizerUnlocked: false }}
				account={{
					userId: 'user-1',
					solved: ['c1'],
					api: api(),
					reload: () =>
						Promise.resolve({
							content: earned,
							solved: ['c1', 'c2'],
						}),
				}}
			>
				<Probe />
			</PlayerProgressProvider>,
		)
		let result: NewRewards | undefined
		await act(async () => {
			result = await progress.markSolved('c2')
		})
		expect(result?.randomizer).toBe(true)
	})

	it('does not reload for a solve that finishes no set', async () => {
		const reload = vi.fn(() => Promise.resolve(null))
		renderAccount({ reload })
		let earned: NewRewards | undefined
		await act(async () => {
			earned = await progress.markSolved('c1')
		})
		expect(reload).not.toHaveBeenCalled()
		expect(earned).toEqual({
			palettes: [],
			bonusSets: [],
			shapes: [],
			accountShape: null,
			randomizer: false,
		})
	})

	it('keeps a solve the server could not take, and retries it when back online', async () => {
		const record = vi
			.fn<AccountProgressApi['record']>()
			.mockRejectedValueOnce(new Error('Offline'))
			.mockResolvedValue([])
		const reload = vi.fn(() => Promise.resolve(null))
		renderAccount({ api: api(record), reload })
		await act(async () => {
			await progress.markSolved('c1')
		})
		expect(loadAccountProgressCache('user-1').pending).toEqual(
			new Set(['c1']),
		)
		expect(progress.solved.has('c1')).toBe(true)
		await act(async () => {
			window.dispatchEvent(new Event('online'))
		})
		await waitFor(() => expect(record).toHaveBeenCalledTimes(2))
		expect(record).toHaveBeenLastCalledWith(['c1'])
		await waitFor(() =>
			expect(loadAccountProgressCache('user-1').pending.size).toBe(0),
		)
		expect(reload).toHaveBeenCalled()
	})

	it('sends solves left pending by an earlier visit', async () => {
		saveAccountProgressCache('user-1', {
			solved: new Set(['c1']),
			pending: new Set(['c1']),
		})
		const record = vi.fn(() => Promise.resolve([] as string[]))
		renderAccount({ api: api(record) })
		expect(progress.solved.has('c1')).toBe(true)
		await waitFor(() => expect(record).toHaveBeenCalledWith(['c1']))
	})

	it('starts from the new player’s progress when the account changes', () => {
		saveAccountProgressCache('user-2', {
			solved: new Set(['other']),
			pending: new Set(['waiting']),
		})
		const { rerender } = renderAccount({ solved: ['c1'] })
		expect([...progress.solved]).toEqual(['c1'])
		rerender(
			<PlayerProgressProvider
				content={before}
				account={{
					userId: 'user-2',
					solved: ['s2'],
					api: api(),
					reload: () => Promise.resolve(null),
				}}
			>
				<Probe />
			</PlayerProgressProvider>,
		)
		expect([...progress.solved].sort()).toEqual(['s2', 'waiting'])
		expect(sets).toEqual(['core'])
	})
})
