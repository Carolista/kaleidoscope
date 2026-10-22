import { faPenToSquare, faRotate } from '@fortawesome/pro-solid-svg-icons'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useState } from 'react'
import type { Puzzle } from '@/domain/puzzles'
import { useCatalog } from '@/features/admin/catalog'
import type { Database } from '@/lib/supabase'
import {
	AdminFeedback,
	AdminIconButton,
	AdminSectionHeading,
	errorMessage,
} from '@/features/admin/common'
import {
	checkRewardPattern,
	findUnavailablePalettes,
	groupInSlot,
	manageProgressionSlot,
	rewardOf,
	slotGroupLabel,
	slotTitle,
	SLOT_ORDER,
	type Progression,
	type Slot,
} from '@/features/admin/services'
import { Loading, PaletteStrip } from '@/ui/components'
import { PuzzleBoard } from '@/ui/puzzle'
import { useModalState } from '@/ui/hooks'
import { shapeName } from './labels'
import styles from './ProgressionSlots.module.css'
import SlotDialog, { type SlotChoice } from './SlotDialog'
import useProgressionData from './useProgressionData'

const fallbackError = 'Unable to manage puzzle groups and rewards.'

function SlotCard({
	slot,
	progression,
	paletteNames,
	paletteColors,
	preview,
	disabled,
	onEdit,
}: {
	readonly slot: Slot
	readonly progression: Progression
	readonly paletteNames: ReadonlyMap<string, string>
	readonly paletteColors: ReadonlyMap<string, readonly string[]>
	// The first puzzle of the slot's group, once the groups have loaded.
	readonly preview: Puzzle | null | undefined
	readonly disabled: boolean
	readonly onEdit: () => void
}) {
	const group = groupInSlot(progression.groups, slot)
	const paletteId = group
		? rewardOf(progression, group.id).paletteIds[0]
		: undefined
	const title = slotTitle(slot)
	const shape = shapeName(slot.shapeId)
	return (
		<div
			className={styles.slot}
			role="group"
			aria-label={`${shape} ${title}`}
		>
			<div className={styles.slotHeading}>
				<h4>{title}</h4>
				<AdminIconButton
					icon={faPenToSquare}
					tone="edit"
					label={`Edit ${shape} ${title}`}
					disabled={disabled || !!group?.published}
					onClick={onEdit}
				/>
			</div>
			<p
				className={
					group
						? styles.groupName
						: `${styles.groupName} ${styles.empty}`
				}
			>
				{group?.name ?? 'Not assigned'}
			</p>
			<div className={styles.body}>
				{group && (
					<div className={styles.thumbnail} aria-hidden="true">
						{preview && (
							<PuzzleBoard
								target
								gridlines={false}
								shape={preview.shape}
								gridSize={preview.gridSize}
								colors={preview.target}
							/>
						)}
					</div>
				)}
				<div className={styles.rewardBox}>
					<p className={styles.rewardLabel}>Reward</p>
					{paletteId ? (
						<div className={styles.reward}>
							<PaletteStrip
								colors={paletteColors.get(paletteId) ?? []}
							/>
							<span>
								{paletteNames.get(paletteId) ?? paletteId}
							</span>
						</div>
					) : (
						<span className={styles.empty}>
							{group ? 'No palette yet' : '—'}
						</span>
					)}
				</div>
			</div>
		</div>
	)
}

// Each shape's four slots: basic and rotation core groups, and the basic and rotation bonus
// groups awarded with the rotation core group. Editing a slot picks its puzzle group and
// the palette it awards.
export default function ProgressionSlots({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const data = useProgressionData(client, true)
	const groups = useCatalog('puzzleGroups', client)
	const progression = data.progression
	const paletteGroups = data.paletteGroups ?? []
	const [editing, setEditing, editModal] = useModalState<Slot>()
	const [status, setStatus] = useState('')
	const paletteNames = new Map(
		(data.palettes ?? []).map(palette => [palette.id, palette.name]),
	)
	const paletteColors = new Map(
		(data.palettes ?? []).map(palette => [palette.id, palette.colors]),
	)

	async function save(slot: Slot, choice: SlotChoice) {
		const name =
			progression?.candidates.find(item => item.id === choice.groupId)
				?.name ??
			(progression
				? groupInSlot(progression.groups, slot)?.name
				: undefined)
		await manageProgressionSlot(
			client,
			slot,
			choice.groupId,
			choice.paletteIds,
		)
		// A saved slot can change several groups, so reload rather than patch the cache.
		data.invalidate('puzzleGroups', 'puzzleDrafts')
		void data.reloadProgression().catch(() => {})
		const where = `${slotGroupLabel(slot).toLowerCase()} for ${shapeName(slot.shapeId)}`
		setStatus(
			choice.groupId
				? `Saved the ${where}: "${name}".`
				: `Emptied the ${where}.`,
		)
		setEditing(null)
	}

	// Warnings only: nothing here blocks publishing yet.
	const warnings = progression
		? checkRewardPattern(progression, {
				shape: shapeName,
				palette: id => paletteNames.get(id) ?? id,
			})
		: []
	const generalWarnings = warnings.filter(warning => warning.shapeId === null)
	const unavailable =
		data.puzzles && data.paletteGroups
			? findUnavailablePalettes({
					puzzles: data.puzzles.map(puzzle => ({
						name: puzzle.row.name,
						paletteId: puzzle.row.palette_id,
						groupName: puzzle.groupName,
					})),
					paletteGroups: data.paletteGroups,
					paletteName: id => paletteNames.get(id) ?? id,
				})
			: []

	return (
		<section aria-labelledby="progression-slots-title">
			<AdminSectionHeading
				id="progression-slots-title"
				title="Puzzles and rewards"
			>
				<AdminIconButton
					icon={faRotate}
					label="Refresh puzzles and rewards"
					disabled={data.loading}
					onClick={() => {
						setStatus('')
						void data.refresh().catch(() => {})
						void groups.refresh().catch(() => {})
					}}
				/>
			</AdminSectionHeading>
			<p>
				Each shape has a basic and a rotation core group. Completing the
				basic core group also awards the basic bonus group; completing
				the rotation core group awards both bonus groups. Every group
				awards one palette from a reward palette group. Warnings do not
				block publishing.
			</p>
			<AdminFeedback
				error={
					data.error || groups.error
						? errorMessage(
								data.error ?? groups.error,
								fallbackError,
							)
						: ''
				}
				status={status}
			/>
			{generalWarnings.length > 0 && (
				<ul
					className={styles.warnings}
					aria-label="General pattern warnings"
				>
					{generalWarnings.map(warning => (
						<li key={warning.message}>{warning.message}</li>
					))}
				</ul>
			)}
			{data.loading && !progression ? (
				<Loading label="Loading puzzles and rewards…" />
			) : (
				progression &&
				progression.shapeIds.map(shapeId => {
					const shape = shapeName(shapeId)
					const slots = (purpose: Slot['purpose']): Slot[] =>
						SLOT_ORDER.filter(item => item.purpose === purpose).map(
							item => ({
								shapeId,
								...item,
							}),
						)
					const shapeWarnings = warnings.filter(
						warning => warning.shapeId === shapeId,
					)
					const column = (purpose: Slot['purpose'], name: string) => (
						<div
							className={styles.column}
							role="group"
							aria-label={`${shape} ${name} groups`}
						>
							{slots(purpose).map(slot => (
								<SlotCard
									key={slot.track}
									slot={slot}
									progression={progression}
									paletteNames={paletteNames}
									paletteColors={paletteColors}
									preview={
										groups.data?.find(
											item =>
												item.row.id ===
												groupInSlot(
													progression.groups,
													slot,
												)?.id,
										)?.preview
									}
									disabled={data.loading || !!editing}
									onEdit={() => {
										setStatus('')
										setEditing(slot)
									}}
								/>
							))}
						</div>
					)
					return (
						<section
							key={shapeId}
							className={styles.shape}
							aria-labelledby={`slots-${shapeId}`}
						>
							<h3 id={`slots-${shapeId}`}>{shape}</h3>
							<div className={styles.columns}>
								{column('core', 'core')}
								{column('reward', 'bonus')}
							</div>
							{shapeWarnings.length > 0 && (
								<ul
									className={styles.warnings}
									aria-label={`${shape} pattern warnings`}
								>
									{shapeWarnings.map(warning => (
										<li key={warning.message}>
											{warning.message}
										</li>
									))}
								</ul>
							)}
						</section>
					)
				})
			)}
			{unavailable.length > 0 && (
				<section
					className={styles.shape}
					aria-labelledby="slots-unavailable"
				>
					<h3 id="slots-unavailable">Palettes players cannot get</h3>
					<p>
						These palettes are used by grouped puzzles but are not
						in a core, reward, or pack palette group, so the store
						could not offer them.
					</p>
					<ul className={styles.warnings}>
						{unavailable.map(item => (
							<li key={item.paletteId}>
								<strong>{item.paletteName}</strong>:{' '}
								{item.puzzles.join(', ')}
							</li>
						))}
					</ul>
				</section>
			)}
			{editing && progression && (
				<SlotDialog
					{...editModal}
					slot={editing}
					current={groupInSlot(progression.groups, editing)}
					progression={progression}
					paletteGroups={paletteGroups}
					onSave={choice => save(editing, choice)}
					onCancel={() => setEditing(null)}
				/>
			)}
		</section>
	)
}
