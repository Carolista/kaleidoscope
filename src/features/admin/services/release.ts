import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase'

export type ReleaseAction = 'schedule' | 'cancel'
// A shape package is the shape's four core and bonus groups, released together (its id is the
// shape id). Other groups are released on their own. Palettes are only released and returned to
// draft along with the groups that use them.
export type ReleaseKind = 'shape_package' | 'puzzle_group' | 'palette_group'
export type ReleaseItemKind =
	'palette' | 'puzzle' | 'puzzle_group' | 'palette_group'
export type ReleaseState = 'draft' | 'scheduled' | 'live'
// What a plan does to one item. Live and unchanged items are listed but never touched.
export type ReleaseChange =
	'release' | 'earlier' | 'reschedule' | 'keep' | 'live' | 'cancel'

export interface ReleaseRequest {
	readonly action: ReleaseAction
	readonly kind: ReleaseKind
	readonly id: string
	// Null releases immediately. Only meaningful when scheduling.
	readonly releaseAt?: string | null
}

export interface ReleaseItem {
	readonly kind: ReleaseItemKind
	readonly id: string
	readonly name: string
	readonly state: ReleaseState
	readonly change: ReleaseChange
	readonly previousReleaseAt: string | null
	readonly releaseAt: string | null
}

export interface ReleasePlan {
	readonly action: ReleaseAction
	readonly kind: ReleaseKind
	readonly id: string
	readonly name: string
	readonly state: ReleaseState
	// The instant a schedule would release at; null when cancelling.
	readonly releaseAt: string | null
	// In dependency order: palettes, puzzles, bonus groups, then the requested group.
	readonly items: readonly ReleaseItem[]
	readonly blockers: readonly string[]
	readonly warnings: readonly string[]
}

const actions: readonly string[] = ['schedule', 'cancel']
const kinds: readonly string[] = [
	'shape_package',
	'puzzle_group',
	'palette_group',
]
const itemKinds: readonly string[] = [
	'palette',
	'puzzle',
	'puzzle_group',
	'palette_group',
]
const states: readonly string[] = ['draft', 'scheduled', 'live']
const changes: readonly string[] = [
	'release',
	'earlier',
	'reschedule',
	'keep',
	'live',
	'cancel',
]

function isRecord(
	value: Json | undefined,
): value is Record<string, Json | undefined> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: Json | undefined, what: string): string {
	if (typeof value !== 'string')
		throw new Error(`The release plan is malformed (${what}).`)
	return value
}

function oneOf<T extends string>(
	value: Json | undefined,
	allowed: readonly string[],
	what: string,
): T {
	const result = text(value, what)
	if (!allowed.includes(result))
		throw new Error(`The release plan is malformed (${what}).`)
	return result as T
}

function nullableText(value: Json | undefined, what: string): string | null {
	return value === null || value === undefined ? null : text(value, what)
}

function texts(value: Json | undefined, what: string): string[] {
	if (!Array.isArray(value))
		throw new Error(`The release plan is malformed (${what}).`)
	return value.map(entry => text(entry, what))
}

export function parseReleasePlan(value: Json | null): ReleasePlan {
	if (!isRecord(value ?? undefined))
		throw new Error('The release plan is malformed.')
	const plan = value as Record<string, Json | undefined>
	if (!Array.isArray(plan.items))
		throw new Error('The release plan is malformed (items).')
	return {
		action: oneOf(plan.action, actions, 'action'),
		kind: oneOf(plan.kind, kinds, 'kind'),
		id: text(plan.id, 'id'),
		name: text(plan.name, 'name'),
		state: oneOf(plan.state, states, 'state'),
		releaseAt: nullableText(plan.release_at, 'release time'),
		items: plan.items.map(item => {
			if (!isRecord(item))
				throw new Error('The release plan is malformed (item).')
			return {
				kind: oneOf(item.kind, itemKinds, 'item kind'),
				id: text(item.id, 'item id'),
				name: text(item.name, 'item name'),
				state: oneOf(item.state, states, 'item state'),
				change: oneOf(item.change, changes, 'item change'),
				previousReleaseAt: nullableText(
					item.previous_release_at,
					'previous release',
				),
				releaseAt: nullableText(item.release_at, 'item release'),
			}
		}),
		blockers: texts(plan.blockers, 'blockers'),
		warnings: texts(plan.warnings, 'warnings'),
	}
}

function args(request: ReleaseRequest) {
	return {
		p_action: request.action,
		p_kind: request.kind,
		p_id: request.id,
		...(request.releaseAt ? { p_release_at: request.releaseAt } : {}),
	}
}

// What a schedule or cancel would do, without changing anything.
export async function previewRelease(
	client: SupabaseClient<Database>,
	request: ReleaseRequest,
): Promise<ReleasePlan> {
	const { data, error } = await client.rpc('preview_release', args(request))
	if (error) throw new Error(`Unable to check the release: ${error.message}`)
	return parseReleasePlan(data)
}

// Runs the plan in one transaction; the database rejects it if anything blocks it.
export async function applyRelease(
	client: SupabaseClient<Database>,
	request: ReleaseRequest,
): Promise<ReleasePlan> {
	const { data, error } = await client.rpc('apply_release', args(request))
	if (error) throw new Error(`Unable to change the release: ${error.message}`)
	return parseReleasePlan(data)
}

// The shape whose package a puzzle group belongs to: core and bonus groups in a slot. Null for
// groups released on their own (daily, pack, undecided, or without a shape and track).
export function packageShapeOf(group: {
	readonly purpose: string | null
	readonly shape_id: string | null
	readonly track: string | null
}): string | null {
	return (group.purpose === 'core' || group.purpose === 'reward') &&
		group.shape_id &&
		group.track
		? group.shape_id
		: null
}

// Draft, scheduled, or live, from a row's release columns.
export function releaseStateOf(row: {
	readonly published_at: string | null
	readonly release_at: string | null
}): ReleaseState {
	if (!row.published_at) return 'draft'
	return row.release_at && Date.parse(row.release_at) > Date.now()
		? 'scheduled'
		: 'live'
}

export interface ChangeCounts {
	readonly palette: number
	readonly puzzle: number
	readonly puzzle_group: number
	readonly palette_group: number
}

// Items a plan will actually change, counted by kind.
export function changedCounts(plan: Pick<ReleasePlan, 'items'>): ChangeCounts {
	const counts = { palette: 0, puzzle: 0, puzzle_group: 0, palette_group: 0 }
	for (const item of plan.items)
		if (item.change !== 'keep' && item.change !== 'live')
			counts[item.kind]++
	return counts
}

// The value of a datetime-local input for an instant, in the browser's time zone.
export function toLocalInputValue(instant: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0')
	return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}T${pad(instant.getHours())}:${pad(instant.getMinutes())}`
}

// The instant for a datetime-local value read in the browser's time zone, or null if invalid.
export function fromLocalInputValue(value: string): string | null {
	if (!value) return null
	const instant = new Date(value)
	return Number.isNaN(instant.getTime()) ? null : instant.toISOString()
}
