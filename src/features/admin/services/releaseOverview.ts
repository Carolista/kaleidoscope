import type { PaletteGroup } from './paletteGroups'
import {
	groupInSlot,
	rewardOf,
	type Progression,
	type Slot,
} from './progression'
import type { PuzzleGroup } from './puzzleGroups'
import { releaseStateOf, type ReleaseState } from './release'
import { slotTitle, SLOT_ORDER } from './rewardPattern'

// The size rules the database enforces when releasing core, bonus, and reward groups.
export const PUZZLES_PER_GROUP = 24
export const PALETTES_PER_GROUP = 6

export interface SlotRelease {
	readonly slot: Slot
	readonly title: string
	readonly group: { readonly id: string; readonly name: string } | null
	// The group's release columns, once the puzzle groups have loaded.
	readonly row: PuzzleGroup['row'] | null
	readonly state: ReleaseState | 'empty'
	readonly puzzleCount: number
	readonly paletteId: string | null
	// Bonus groups this group awards when completed.
	readonly unlocks: readonly string[]
	// Problems the database would block a release for; the release dialog has the full check.
	readonly issues: readonly string[]
}

export function slotReleases(
	progression: Pick<Progression, 'groups' | 'rewards'>,
	puzzleGroups: readonly PuzzleGroup[],
	shapeId: string,
): SlotRelease[] {
	return SLOT_ORDER.map(({ purpose, track }) => {
		const slot: Slot = { shapeId, purpose, track }
		const title = slotTitle(slot)
		const group = groupInSlot(progression.groups, slot)
		if (!group)
			return {
				slot,
				title,
				group: null,
				row: null,
				state: 'empty',
				puzzleCount: 0,
				paletteId: null,
				unlocks: [],
				issues: [],
			}
		const loaded = puzzleGroups.find(item => item.row.id === group.id)
		const reward = rewardOf(progression, group.id)
		const puzzleCount = loaded?.members.length ?? 0
		const issues: string[] = []
		if (loaded && puzzleCount !== PUZZLES_PER_GROUP)
			issues.push(
				`Has ${puzzleCount} puzzles; needs exactly ${PUZZLES_PER_GROUP}.`,
			)
		if (reward.paletteIds.length === 0) issues.push('Awards no palette.')
		return {
			slot,
			title,
			group: { id: group.id, name: group.name },
			row: loaded?.row ?? null,
			state: loaded ? releaseStateOf(loaded.row) : 'draft',
			puzzleCount,
			paletteId: reward.paletteIds[0] ?? null,
			unlocks: reward.bonusGroupIds.map(
				id =>
					progression.groups.find(item => item.id === id)?.name ?? id,
			),
			issues,
		}
	})
}

export interface PackageRelease {
	// A group row standing for the whole package; all four share one release when it is scheduled.
	readonly row: PuzzleGroup['row'] | null
	readonly state: ReleaseState | 'partial'
	readonly filled: number
	// Everything that would block releasing the package, slot by slot.
	readonly issues: readonly string[]
}

// A shape's four slots taken together: filled count, state, and what blocks releasing them.
export function packageRelease(slots: readonly SlotRelease[]): PackageRelease {
	const rows = slots.flatMap(slot => (slot.row ? [slot.row] : []))
	const states = new Set(rows.map(releaseStateOf))
	const state: ReleaseState | 'partial' =
		states.size === 0
			? 'draft'
			: states.size === 1
				? [...states][0]
				: 'partial'
	return {
		row:
			rows.find(row => releaseStateOf(row) !== 'draft') ??
			rows[0] ??
			null,
		state,
		filled: slots.filter(slot => slot.group).length,
		issues: slots.flatMap(slot =>
			slot.group
				? slot.issues.map(issue => `${slot.title}: ${issue}`)
				: [`${slot.title}: needs a puzzle group.`],
		),
	}
}

export interface StateCounts {
	readonly draft: number
	readonly scheduled: number
	readonly live: number
}

// How many palettes of some groups have gone out. Reward palettes are released
// one by one with what awards them, never as groups, so this is their status.
export function paletteProgress(
	groups: readonly PaletteGroup[],
	palettes: ReadonlyMap<
		string,
		{
			readonly published_at: string | null
			readonly release_at: string | null
		}
	>,
): StateCounts & { readonly total: number } {
	const counts = { draft: 0, scheduled: 0, live: 0 }
	for (const group of groups)
		for (const member of group.members) {
			const palette = palettes.get(member.id)
			counts[palette ? releaseStateOf(palette) : 'draft']++
		}
	return { ...counts, total: counts.draft + counts.scheduled + counts.live }
}

export function countStates(
	rows: readonly {
		readonly published_at: string | null
		readonly release_at: string | null
	}[],
): StateCounts {
	const counts = { draft: 0, scheduled: 0, live: 0 }
	for (const row of rows) counts[releaseStateOf(row)]++
	return counts
}

const paletteGroupOrder = ['core', 'reward', 'pack', 'undecided']

// Palette groups for the overview: core, reward, pack, then undecided, each by name.
export function sortPaletteGroups(
	groups: readonly PaletteGroup[],
): PaletteGroup[] {
	return [...groups].sort(
		(a, b) =>
			paletteGroupOrder.indexOf(a.purpose) -
				paletteGroupOrder.indexOf(b.purpose) ||
			a.row.name.localeCompare(b.row.name),
	)
}

// Palette groups the database requires to hold exactly six palettes.
export function paletteGroupIssue(group: PaletteGroup): string {
	if (group.purpose === 'undecided') return 'Choose a purpose.'
	if (group.members.length === 0) return 'Has no palettes.'
	if (
		(group.purpose === 'core' || group.purpose === 'reward') &&
		group.members.length !== PALETTES_PER_GROUP
	)
		return `Has ${group.members.length} palettes; needs exactly ${PALETTES_PER_GROUP}.`
	return ''
}

// Puzzle groups that fill no progression slot: daily, pack, undecided, or unslotted ones.
export function otherPuzzleGroups(
	progression: Pick<Progression, 'groups'>,
	puzzleGroups: readonly PuzzleGroup[],
): PuzzleGroup[] {
	const slotted = new Set(progression.groups.map(group => group.id))
	return puzzleGroups
		.filter(group => !slotted.has(group.row.id))
		.sort((a, b) => a.row.name.localeCompare(b.row.name))
}
