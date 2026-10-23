import type { SupabaseClient } from '@supabase/supabase-js'
import { useId, useMemo, useRef, useState } from 'react'
import { useCatalogInvalidation } from '@/features/admin/catalog'
import { AdminForm, errorMessage } from '@/features/admin/common'
import {
	applyRelease,
	changedCounts,
	fromLocalInputValue,
	toLocalInputValue,
	type ReleaseAction,
	type ReleaseItem,
	type ReleaseItemKind,
	type ReleaseKind,
	type ReleasePlan,
	type ReleaseRequest,
} from '@/features/admin/services'
import type { Database } from '@/lib/supabase'
import {
	Checkbox,
	ConfirmDialog,
	FormField,
	Input,
	Loading,
} from '@/ui/components'
import { useUnsavedDraft } from '@/ui/navigation'
import { itemKindLabels, itemNote, summaryText } from './releaseText'
import styles from './ReleaseDialog.module.css'
import useReleasePlan from './useReleasePlan'

export interface ReleaseTarget {
	readonly action: ReleaseAction
	readonly kind: ReleaseKind
	readonly id: string
	readonly name: string
	// The group's current release time, when it is already scheduled.
	readonly currentReleaseAt?: string | null
}

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

function ItemList({ items }: { readonly items: readonly ReleaseItem[] }) {
	return (
		<ul className={styles.items}>
			{items.map(item => {
				const note = itemNote(item)
				return (
					<li key={`${item.kind}-${item.id}`}>
						{item.name}
						{note && <span className={styles.note}> ({note})</span>}
					</li>
				)
			})}
		</ul>
	)
}

// Previews what scheduling or cancelling a group (or cancelling a palette) will do, lists
// blockers and warnings, and applies it in one step. Groups also release what they depend on.
export default function ReleaseDialog({
	open,
	onAfterClose,
	client,
	target,
	onDone,
	onCancel,
}: {
	readonly open: boolean
	readonly onAfterClose: () => void
	readonly client: SupabaseClient<Database>
	readonly target: ReleaseTarget
	readonly onDone: (plan: ReleasePlan) => void
	readonly onCancel: () => void
}) {
	const id = useId()
	const invalidate = useCatalogInvalidation()
	const scheduling = target.action === 'schedule'
	const [releaseNow, setReleaseNow] = useState(false)
	const [when, setWhen] = useState(
		target.currentReleaseAt
			? toLocalInputValue(new Date(target.currentReleaseAt))
			: '',
	)
	const [reviewed, setReviewed] = useState<ReleasePlan | null>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const working = useRef(false)
	const whenInput = useRef<HTMLInputElement>(null)
	useUnsavedDraft({ dirty: false, pending: busy })

	const releaseAt =
		scheduling && !releaseNow ? fromLocalInputValue(when) : null
	const request = useMemo<ReleaseRequest | null>(
		() =>
			scheduling && !releaseNow && !releaseAt
				? null
				: {
						action: target.action,
						kind: target.kind,
						id: target.id,
						releaseAt,
					},
		[
			scheduling,
			releaseNow,
			releaseAt,
			target.action,
			target.kind,
			target.id,
		],
	)
	const { plan, error: planError, loading } = useReleasePlan(client, request)

	const counts = plan ? changedCounts(plan) : null
	const changed = counts
		? counts.palette +
			counts.puzzle +
			counts.puzzle_group +
			counts.palette_group
		: 0
	const itemsOf = (kind: ReleaseItemKind) =>
		plan?.items.filter(item => item.kind === kind) ?? []
	const puzzles = itemsOf('puzzle')
	const warned = !!plan && plan.warnings.length > 0
	const blocked = !!plan && plan.blockers.length > 0
	const confirmDisabled =
		!plan || blocked || changed === 0 || (warned && reviewed !== plan)

	const destructive = !scheduling || releaseNow
	const confirmLabel = !scheduling
		? 'Unschedule'
		: releaseNow
			? 'Release now'
			: target.currentReleaseAt
				? 'Reschedule'
				: 'Schedule'
	const title = !scheduling
		? `Unschedule "${target.name}"`
		: target.currentReleaseAt
			? `Reschedule "${target.name}"`
			: `Release "${target.name}"`

	async function confirm() {
		if (working.current || !request) return
		working.current = true
		setBusy(true)
		setError('')
		try {
			const applied = await applyRelease(client, request)
			invalidate(
				'puzzleGroups',
				'puzzleDrafts',
				'preparedPuzzles',
				'palettes',
				'paletteGroups',
				'progression',
			)
			onDone(applied)
		} catch (cause) {
			setError(errorMessage(cause, 'Unable to change the release.'))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	return (
		<ConfirmDialog
			open={open}
			onAfterClose={onAfterClose}
			title={title}
			closeLabel="Close release dialog"
			initialFocusRef={whenInput}
			confirmLabel={confirmLabel}
			confirmForm={`${id}-form`}
			confirmDisabled={confirmDisabled}
			destructive={destructive}
			onConfirm={() => {}}
			onCancel={onCancel}
			pending={busy ? 'Saving…' : null}
			error={error}
		>
			<AdminForm
				id={`${id}-form`}
				aria-label="Release details"
				onSubmit={event => {
					event.preventDefault()
					void confirm()
				}}
			>
				{scheduling && (
					<fieldset className={styles.when} disabled={busy}>
						<legend>When</legend>
						<label className={styles.choice}>
							<input
								type="radio"
								name={`${id}-when`}
								checked={!releaseNow}
								onChange={() => setReleaseNow(false)}
							/>
							Schedule for a date and time
						</label>
						<FormField
							id={`${id}-time`}
							label="Release time"
							help={`In your time zone (${timeZone}).`}
						>
							{field => (
								<Input
									{...field}
									ref={whenInput}
									type="datetime-local"
									value={when}
									disabled={busy || releaseNow}
									onChange={event =>
										setWhen(event.target.value)
									}
								/>
							)}
						</FormField>
						<label className={styles.choice}>
							<input
								type="radio"
								name={`${id}-when`}
								checked={releaseNow}
								onChange={() => setReleaseNow(true)}
							/>
							Release now
						</label>
					</fieldset>
				)}
				{!request && (
					<p>Choose a release time to see what will be released.</p>
				)}
				{loading && <Loading label="Checking what this will change…" />}
				{planError !== undefined && (
					<p role="alert">
						{errorMessage(
							planError,
							'Unable to check the release.',
						)}
					</p>
				)}
				{plan && (
					<>
						{blocked && (
							<div role="alert" className={styles.blockers}>
								<h3>Cannot go ahead yet</h3>
								<ul>
									{plan.blockers.map(blocker => (
										<li key={blocker}>{blocker}</li>
									))}
								</ul>
							</div>
						)}
						{counts && (
							<p role="status">
								{summaryText(plan.action, counts, releaseNow)}
							</p>
						)}
						{(
							[
								'palette_group',
								'puzzle_group',
								'palette',
							] as const
						).map(kind => {
							const items = itemsOf(kind)
							return items.length > 0 ? (
								<section key={kind}>
									<h3>
										{`${itemKindLabels[kind].many[0].toUpperCase()}${itemKindLabels[kind].many.slice(1)}`}{' '}
										({items.length})
									</h3>
									<ItemList items={items} />
								</section>
							) : null
						})}
						{puzzles.length > 0 && (
							<details>
								<summary>Puzzles ({puzzles.length})</summary>
								<ItemList items={puzzles} />
							</details>
						)}
						{warned && (
							<div className={styles.warnings}>
								<h3>Check before continuing</h3>
								<ul>
									{plan.warnings.map(warning => (
										<li key={warning}>{warning}</li>
									))}
								</ul>
								<Checkbox
									plain
									label="I have reviewed these warnings"
									checked={reviewed === plan}
									disabled={busy}
									onChange={checked =>
										setReviewed(checked ? plan : null)
									}
								/>
							</div>
						)}
					</>
				)}
			</AdminForm>
		</ConfirmDialog>
	)
}
