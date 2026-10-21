import { faPenToSquare, faRotate } from '@fortawesome/pro-solid-svg-icons'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useState } from 'react'
import type { Database } from '@/lib/supabase'
import {
	AdminFeedback,
	AdminIconButton,
	AdminSectionHeading,
	AdminTag,
	errorMessage,
} from '@/features/admin/common'
import {
	checkRewardPattern,
	coreGroupsOf,
	manageGroupReward,
	puzzleGroupTrackLabels,
	rewardOf,
	type PaletteGroup,
	type Progression,
	type ProgressionGroup,
} from '@/features/admin/services'
import { Loading, PaletteStrip } from '@/ui/components'
import { useModalState } from '@/ui/hooks'
import { shapeName } from './labels'
import RewardDialog, { type RewardChoice } from './RewardDialog'
import useProgressionData from './useProgressionData'

const fallbackError = 'Unable to manage rewards.'

function RewardRow({
	group,
	progression,
	paletteGroups,
	paletteNames,
	disabled,
	onEdit,
}: {
	readonly group: ProgressionGroup
	readonly progression: Progression
	readonly paletteGroups: readonly PaletteGroup[]
	readonly paletteNames: ReadonlyMap<string, string>
	readonly disabled: boolean
	readonly onEdit: () => void
}) {
	const reward = rewardOf(progression, group.id)
	const colors = (id: string) =>
		paletteGroups
			.flatMap(candidate => candidate.members)
			.find(m => m.id === id)?.colors
	const bonus = reward.bonusGroupIds.map(
		id =>
			progression.groups.find(candidate => candidate.id === id)?.name ??
			id,
	)
	return (
		<li aria-label={`Reward for ${group.name}`}>
			<strong>{group.name}</strong>{' '}
			<AdminTag>
				{puzzleGroupTrackLabels[group.track ?? 'basic']}
			</AdminTag>
			{group.published && <AdminTag>Published</AdminTag>}
			<AdminIconButton
				icon={faPenToSquare}
				tone="edit"
				label={`Edit reward for ${group.name}`}
				disabled={disabled || group.published}
				onClick={onEdit}
			/>
			<div>
				{reward.paletteIds.length === 0 && bonus.length === 0 ? (
					<span>Awards nothing yet</span>
				) : (
					<>
						{reward.paletteIds.map(id => (
							<span key={id}>
								{colors(id) && (
									<PaletteStrip colors={colors(id) ?? []} />
								)}{' '}
								{paletteNames.get(id) ?? id}
							</span>
						))}
						{bonus.length > 0 && (
							<span> Bonus groups: {bonus.join(', ')}</span>
						)}
					</>
				)}
			</div>
		</li>
	)
}

// Rewards shape by shape: basic core -> palette; rotation core -> palette and two bonus
// groups; each bonus group -> palette.
export default function ProgressionRewards({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const data = useProgressionData(client)
	const progression = data.progression
	const paletteGroups = data.paletteGroups ?? []
	const [editing, setEditing, editModal] = useModalState<ProgressionGroup>()
	const [status, setStatus] = useState('')
	const paletteNames = new Map(
		(data.palettes ?? []).map(palette => [palette.id, palette.name]),
	)

	async function save(group: ProgressionGroup, reward: RewardChoice) {
		await manageGroupReward(client, group.id, reward)
		data.updateProgression(previous => ({
			...previous,
			rewards: [
				...previous.rewards.filter(item => item.groupId !== group.id),
				...(reward.paletteIds.length || reward.bonusGroupIds.length
					? [{ groupId: group.id, ...reward }]
					: []),
			],
		}))
		setStatus(`Saved the reward for "${group.name}".`)
		setEditing(null)
	}

	const warnings = progression
		? checkRewardPattern(progression, {
				shape: shapeName,
				palette: id => paletteNames.get(id) ?? id,
			})
		: []
	const busy = data.loading

	return (
		<section aria-labelledby="progression-rewards-title">
			<AdminSectionHeading id="progression-rewards-title" title="Rewards">
				<AdminIconButton
					icon={faRotate}
					label="Refresh rewards"
					disabled={busy}
					onClick={() => {
						setStatus('')
						void data.refresh().catch(() => {})
					}}
				/>
			</AdminSectionHeading>
			<p>
				For each shape: the basic core group awards one palette; the
				rotation core group awards one palette plus a basic and a
				rotation bonus group; each bonus group awards one palette.
				Palettes come from reward palette groups.
			</p>
			<AdminFeedback
				error={
					data.error ? errorMessage(data.error, fallbackError) : ''
				}
				status={status}
			/>
			{data.loading && !progression ? (
				<Loading label="Loading rewards…" />
			) : (
				progression &&
				progression.shapeIds.map(shapeId => {
					const { basic, rotation } = coreGroupsOf(
						progression.groups,
						shapeId,
					)
					const bonusGroups = progression.groups.filter(
						group =>
							group.purpose === 'reward' &&
							group.shapeId === shapeId,
					)
					const shapeWarnings = warnings.filter(
						warning => warning.shapeId === shapeId,
					)
					const row = (group: ProgressionGroup) => (
						<RewardRow
							key={group.id}
							group={group}
							progression={progression}
							paletteGroups={paletteGroups}
							paletteNames={paletteNames}
							disabled={busy || !!editing}
							onEdit={() => {
								setStatus('')
								setEditing(group)
							}}
						/>
					)
					return (
						<section
							key={shapeId}
							aria-labelledby={`rewards-${shapeId}`}
						>
							<h3 id={`rewards-${shapeId}`}>
								{shapeName(shapeId)}
							</h3>
							<ul>
								{basic ? (
									row(basic)
								) : (
									<li>No basic core group yet.</li>
								)}
								{rotation ? (
									row(rotation)
								) : (
									<li>No rotation core group yet.</li>
								)}
							</ul>
							{bonusGroups.length > 0 && (
								<>
									<h4>Bonus groups</h4>
									<ul>{bonusGroups.map(row)}</ul>
								</>
							)}
							{shapeWarnings.length > 0 && (
								<ul
									aria-label={`${shapeName(shapeId)} pattern warnings`}
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
			{editing && progression && (
				<RewardDialog
					{...editModal}
					group={editing}
					progression={progression}
					paletteGroups={paletteGroups}
					onSave={reward => save(editing, reward)}
					onCancel={() => setEditing(null)}
				/>
			)}
		</section>
	)
}
