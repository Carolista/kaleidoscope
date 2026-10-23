import { useCatalog } from '@/features/admin/catalog'
import {
	AdminFeedback,
	AdminIconButton,
	AdminSectionHeading,
	errorMessage,
} from '@/features/admin/common'
import { useProgressionData } from '@/features/admin/progression'
import {
	countStates,
	otherPuzzleGroups,
	paletteGroupIssue,
	paletteGroupPurposeLabels,
	puzzleGroupPurposeLabels,
	puzzleGroupTrackLabels,
	slotReleases,
	sortPaletteGroups,
	type StateCounts,
} from '@/features/admin/services'
import type { Database } from '@/lib/supabase'
import { Loading } from '@/ui/components'
import { faDot, faRotate } from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useState } from 'react'
import ReleaseActions from './ReleaseActions'
import styles from './ReleaseOverview.module.css'
import { releaseStateText, shapeLabel } from './releaseText'
import ShapePackageSection from './ShapePackageSection'
import useReleaseDialog from './useReleaseDialog'

const fallbackError = 'Unable to load the release overview.'

function describeStates(counts: StateCounts) {
	const dot = <FontAwesomeIcon icon={faDot} aria-hidden="true" />
	return (
		<>
			{counts.draft} drafted {dot} {counts.scheduled} scheduled {dot}{' '}
			{counts.live} live{' '}
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
						<p className={styles.summary}>
							<span>
								<span className={styles.summaryHeading}>
									Puzzle groups:
								</span>{' '}
								{describeStates(
									countStates(
										puzzleGroups.map(group => group.row),
									),
								)}
							</span>
							<span>
								<span className={styles.summaryHeading}>
									Palette groups:
								</span>{' '}
								{describeStates(
									countStates(
										paletteGroups.map(group => group.row),
									),
								)}
							</span>
						</p>
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
															{releaseStateText(
																group.row,
															)}
														</td>
														<td>
															<ReleaseActions
																kind="palette_group"
																id={
																	group.row.id
																}
																name={
																	group.row
																		.name
																}
																row={group.row}
																disabled={busy}
																onStart={
																	release.start
																}
															/>
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
														{group.track
															? ` · ${puzzleGroupTrackLabels[group.track]}`
															: ''}
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
