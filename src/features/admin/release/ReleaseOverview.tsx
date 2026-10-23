import { useCatalog } from '@/features/admin/catalog'
import {
	AdminFeedback,
	AdminIconButton,
	AdminSectionHeading,
	errorMessage,
	SeparatorDot,
} from '@/features/admin/common'
import { useProgressionData } from '@/features/admin/progression'
import {
	countStates,
	otherPuzzleGroups,
	paletteGroupIssue,
	paletteGroupPurposeLabels,
	paletteProgress,
	puzzleGroupPurposeLabels,
	puzzleGroupTrackLabels,
	slotReleases,
	sortPaletteGroups,
	type StateCounts,
} from '@/features/admin/services'
import type { Database } from '@/lib/supabase'
import { Loading } from '@/ui/components'
import { faRotate } from '@fortawesome/pro-solid-svg-icons'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useState } from 'react'
import ReleaseActions from './ReleaseActions'
import styles from './ReleaseOverview.module.css'
import { RewardGroupMark } from './ReleaseStatusIcon'
import { releaseStateText, shapeLabel } from './releaseText'
import ShapePackageSection from './ShapePackageSection'
import useReleaseDialog from './useReleaseDialog'

const fallbackError = 'Unable to load the release overview.'

const summaryColumns = ['Drafted', 'Scheduled', 'Live'] as const

function StateCountsRow({
	label,
	counts,
}: {
	readonly label: string
	readonly counts: StateCounts
}) {
	return (
		<tr>
			<th scope="row">{label}</th>
			<td>{counts.draft}</td>
			<td>{counts.scheduled}</td>
			<td>{counts.live}</td>
		</tr>
	)
}

// "2 of 6 live", with any scheduled palettes added, for palettes released one by one.
function describePaletteProgress(progress: {
	readonly live: number
	readonly scheduled: number
	readonly total: number
}) {
	return (
		<>
			{progress.live} of {progress.total} live
			{progress.scheduled > 0 && (
				<>
					{' '}
					<SeparatorDot /> {progress.scheduled} scheduled
				</>
			)}
		</>
	)
}

// Everything that has to go out for launch and where it is:
// each shape's core and bonus groups in unlock order,
// then palette groups, then every other puzzle group.
export default function ReleaseOverview({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const data = useProgressionData(client)
	const groupCatalog = useCatalog('puzzleGroups', client)
	const [status, setStatus] = useState('')
	const release = useReleaseDialog(client, setStatus)
	const progression = data.progression
	const puzzleGroups = groupCatalog.data
	const paletteGroups = sortPaletteGroups(data.paletteGroups ?? [])
	// Reward groups only hold palettes; those are released with what awards them.
	const rewardPaletteGroups = paletteGroups.filter(
		group => group.purpose === 'reward',
	)
	const releasedPaletteGroups = paletteGroups.filter(
		group => group.purpose !== 'reward',
	)
	const palettes = new Map(
		(data.palettes ?? []).map(palette => [palette.id, palette]),
	)
	const loading = (data.loading && !progression) || groupCatalog.loading
	const failure = data.error ?? groupCatalog.error
	const busy = data.loading || groupCatalog.loading || release.active
	const others =
		progression && puzzleGroups
			? otherPuzzleGroups(progression, puzzleGroups)
			: []

	return (
		<section aria-labelledby="release-overview-title">
			<AdminSectionHeading id="release-overview-title" title="Release">
				<AdminIconButton
					icon={faRotate}
					label="Refresh release overview"
					disabled={busy}
					onClick={() => {
						setStatus('')
						void data.refresh().catch(() => {})
						void groupCatalog.refresh().catch(() => {})
					}}
				/>
			</AdminSectionHeading>
			<AdminFeedback
				error={failure ? errorMessage(failure, fallbackError) : ''}
				status={status}
			/>
			{loading ? (
				<Loading label="Loading the release overview…" />
			) : (
				progression &&
				puzzleGroups && (
					<>
						<div className={`${styles.block} ${styles.scroll}`}>
							<table
								className={styles.table}
								aria-label="Release summary"
							>
								<thead className={styles.summary}>
									<tr>
										<th scope="col">Content</th>
										{summaryColumns.map(column => (
											<th key={column} scope="col">
												{column}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									<StateCountsRow
										label="Core & Bonus Groups"
										counts={countStates(
											puzzleGroups
												.filter(
													group =>
														!others.includes(group),
												)
												.map(group => group.row),
										)}
									/>
									<StateCountsRow
										label="Other Puzzle Groups"
										counts={countStates(
											others.map(group => group.row),
										)}
									/>
									<StateCountsRow
										label="Palette Groups"
										counts={countStates(
											releasedPaletteGroups.map(
												group => group.row,
											),
										)}
									/>
									<tr>
										<th scope="row">Reward Palettes</th>
										<td colSpan={3}>
											{describePaletteProgress(
												paletteProgress(
													rewardPaletteGroups,
													palettes,
												),
											)}
										</td>
									</tr>
								</tbody>
							</table>
						</div>
						{progression.shapeIds.map(shapeId => (
							<ShapePackageSection
								key={shapeId}
								shapeId={shapeId}
								slots={slotReleases(
									progression,
									puzzleGroups,
									shapeId,
								)}
								palettes={palettes}
								disabled={busy}
								onStart={release.start}
							/>
						))}
						<section
							className={styles.block}
							aria-labelledby="release-palette-groups"
						>
							<h3 id="release-palette-groups">Palette groups</h3>
							{paletteGroups.length ? (
								<div className={styles.scroll}>
									<table
										className={styles.table}
										aria-label="Palette group release status"
									>
										<thead>
											<tr>
												<th
													scope="col"
													style={{ width: '40%' }}
												>
													Palette group
												</th>
												<th
													scope="col"
													style={{ width: '20%' }}
												>
													Purpose
												</th>
												<th
													scope="col"
													style={{ width: '15%' }}
												>
													Palettes
												</th>
												<th
													scope="col"
													style={{ width: '15%' }}
												>
													Status
												</th>
												<th
													scope="col"
													style={{ width: '10%' }}
												>
													<span
														className={
															styles.hidden
														}
													>
														Actions
													</span>
												</th>
											</tr>
										</thead>
										<tbody>
											{paletteGroups.map(group => {
												const issue =
													paletteGroupIssue(group)
												const progress =
													group.purpose === 'reward'
														? paletteProgress(
																[group],
																palettes,
															)
														: null
												return (
													<tr key={group.row.id}>
														<th scope="row">
															{group.row.name}
														</th>
														<td>
															{
																paletteGroupPurposeLabels[
																	group
																		.purpose
																]
															}
														</td>
														<td>
															{
																group.members
																	.length
															}
															{issue && (
																<span
																	className={
																		styles.issue
																	}
																>
																	{issue}
																</span>
															)}
														</td>
														<td>
															{progress
																? describePaletteProgress(
																		progress,
																	)
																: releaseStateText(
																		group.row,
																	)}
														</td>
														<td>
															{progress ? (
																<RewardGroupMark
																	progress={
																		progress
																	}
																/>
															) : (
																<ReleaseActions
																	kind="palette_group"
																	id={
																		group
																			.row
																			.id
																	}
																	name={
																		group
																			.row
																			.name
																	}
																	row={
																		group.row
																	}
																	issue={
																		issue
																	}
																	disabled={
																		busy
																	}
																	onStart={
																		release.start
																	}
																/>
															)}
														</td>
													</tr>
												)
											})}
										</tbody>
									</table>
								</div>
							) : (
								<p>No palette groups yet.</p>
							)}
						</section>
						<section
							className={styles.block}
							aria-labelledby="release-other-groups"
						>
							<h3 id="release-other-groups">
								Other puzzle groups
							</h3>
							<p className={styles.detail}>
								Daily, pack, and undecided groups, and any group
								not in a progression slot.
							</p>
							{others.length ? (
								<div className={styles.scroll}>
									<table
										className={styles.table}
										aria-label="Other puzzle group release status"
									>
										<thead>
											<tr>
												<th
													scope="col"
													style={{ width: '20%' }}
												>
													Puzzle group
												</th>
												<th
													scope="col"
													style={{ width: '20%' }}
												>
													Purpose
												</th>
												<th
													scope="col"
													style={{ width: '20%' }}
												>
													Shape
												</th>
												<th
													scope="col"
													style={{ width: '15%' }}
												>
													Puzzles
												</th>
												<th
													scope="col"
													style={{ width: '15%' }}
												>
													Status
												</th>
												<th
													scope="col"
													style={{ width: '10%' }}
												>
													<span
														className={
															styles.hidden
														}
													>
														Actions
													</span>
												</th>
											</tr>
										</thead>
										<tbody>
											{others.map(group => (
												<tr key={group.row.id}>
													<th scope="row">
														{group.row.name}
													</th>
													<td>
														{
															puzzleGroupPurposeLabels[
																group.purpose
															]
														}
													</td>
													<td>
														{shapeLabel(
															group.row.shape_id,
														)}
														{group.track && (
															<>
																{' '}
																<SeparatorDot />{' '}
																{
																	puzzleGroupTrackLabels[
																		group
																			.track
																	]
																}
															</>
														)}
													</td>
													<td>
														{group.members.length}
													</td>
													<td>
														{releaseStateText(
															group.row,
														)}
													</td>
													<td>
														<ReleaseActions
															kind="puzzle_group"
															id={group.row.id}
															name={
																group.row.name
															}
															row={group.row}
															issue={
																group.purpose ===
																'undecided'
																	? 'Choose a purpose.'
																	: undefined
															}
															disabled={busy}
															onStart={
																release.start
															}
														/>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<p>Every puzzle group is in a slot.</p>
							)}
						</section>
					</>
				)
			)}
			{release.dialog}
		</section>
	)
}
