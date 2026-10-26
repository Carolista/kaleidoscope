import {
	faEye,
	faPenToSquare,
	faRotate,
} from '@fortawesome/pro-solid-svg-icons'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useState } from 'react'
import {
	PUZZLE_SHAPE_IDS,
	PUZZLE_SHAPE_LABELS,
	renderAuthoredPuzzle,
	type AuthoringPalette,
} from '@/domain/puzzles'
import { useCatalog, useCatalogInvalidation } from '@/features/admin/catalog'
import {
	AdminFeedback,
	AdminGallery,
	AdminIconButton,
	AdminItemCard,
	AdminSectionHeading,
	errorMessage,
} from '@/features/admin/common'
import { compareGroupOrder } from '@/features/admin/groups'
import { ReleaseStateIcon, releaseStateLabel } from '@/features/admin/release'
import {
	PUZZLE_GROUP_PURPOSES,
	puzzleGroupPurposeLabels,
	releaseStateOf,
	type LibraryDraft,
} from '@/features/admin/services'
import type { Database } from '@/lib/supabase'
import { Button, Loading, Select } from '@/ui/components'
import { PuzzleBoard } from '@/ui/puzzle'
import PuzzleDraftEditor from './PuzzleDraftEditor'

const fallbackError = 'Unable to load scheduled and live puzzles.'

function releaseTime(draft: LibraryDraft) {
	return Date.parse(draft.row.release_at ?? '') || 0
}

// Puzzles that are scheduled or live. Scheduled ones open in the regular editor until their
// release; live ones are read-only. Releases are managed through the puzzle's group.
export default function PreparedPuzzleLibrary({
	client,
	status,
	palettes,
	onRefreshPalettes,
	palettesLoading,
	palettesRefreshing,
	palettesError,
}: {
	readonly client: SupabaseClient<Database>
	readonly status: 'scheduled' | 'published'
	readonly palettes: readonly AuthoringPalette[]
	readonly onRefreshPalettes?: () => void
	readonly palettesLoading?: boolean
	readonly palettesRefreshing?: boolean
	readonly palettesError?: boolean
}) {
	const catalog = useCatalog('preparedPuzzles', client)
	const invalidate = useCatalogInvalidation()
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [message, setMessage] = useState('')
	const [purposeFilter, setPurposeFilter] = useState('all')
	const [shapeFilter, setShapeFilter] = useState('all')
	const [groupFilter, setGroupFilter] = useState('all')
	const wanted = status === 'scheduled' ? 'scheduled' : 'live'
	const loading = catalog.loading
	const inStatus = (catalog.data ?? []).filter(
		draft => releaseStateOf(draft.row) === wanted,
	)
	const groupOptions = [
		...new Map(
			inStatus.flatMap(draft =>
				draft.groupId ? [[draft.groupId, draft.groupName ?? '']] : [],
			),
		),
	].sort((a, b) => a[1].localeCompare(b[1]))
	const shownGroup = groupOptions.some(([id]) => id === groupFilter)
		? groupFilter
		: 'all'
	const visible = inStatus
		.filter(
			draft =>
				(purposeFilter === 'all' ||
					draft.groupPurpose === purposeFilter) &&
				(shapeFilter === 'all' || draft.row.shape_id === shapeFilter) &&
				(shownGroup === 'all' || draft.groupId === shownGroup),
		)
		.sort(
			(a, b) =>
				releaseTime(a) - releaseTime(b) ||
				compareGroupOrder(
					{
						groupName: a.groupName,
						position: a.groupPosition,
						name: a.row.name,
					},
					{
						groupName: b.groupName,
						position: b.groupPosition,
						name: b.row.name,
					},
				),
		)
	const selected = inStatus.find(draft => draft.row.id === selectedId)
	const title =
		status === 'scheduled' ? 'Scheduled puzzles' : 'Published puzzles'

	if (selected && status === 'scheduled') {
		return (
			<>
				<AdminFeedback status={message} />
				<p>{releaseStateLabel(selected.row)}.</p>
				<PuzzleDraftEditor
					key={selected.row.id}
					client={client}
					draft={selected}
					palettes={palettes}
					onRefreshPalettes={onRefreshPalettes}
					palettesLoading={palettesLoading}
					palettesRefreshing={palettesRefreshing}
					palettesError={palettesError}
					onCancel={() => setSelectedId(null)}
					onChanged={(text, updated) => {
						setMessage(text)
						catalog.update(previous =>
							updated
								? previous.map(value =>
										value.row.id === updated.row.id
											? updated
											: value,
									)
								: previous.filter(
										value =>
											value.row.id !== selected.row.id,
									),
						)
						setSelectedId(null)
						invalidate('preparedPuzzles', 'puzzleGroups')
					}}
				/>
			</>
		)
	}
	if (selected) {
		const palette = palettes.find(
			value => value.id === selected.row.palette_id,
		)
		const preview = palette
			? renderAuthoredPuzzle(selected.puzzle, palette)
			: null
		return (
			<section aria-labelledby="prepared-puzzle-title">
				<AdminSectionHeading
					id="prepared-puzzle-title"
					title={`${selected.row.name} (read-only)`}
				>
					<Button
						variant="outline"
						onClick={() => setSelectedId(null)}
					>
						Back to puzzles
					</Button>
				</AdminSectionHeading>
				<p>Live puzzles can no longer be changed.</p>
				{preview ? (
					<PuzzleBoard
						target
						label={`${selected.row.name} design`}
						shape={preview.shape}
						gridSize={preview.gridSize}
						colors={preview.target}
					/>
				) : (
					<p>Palette unavailable.</p>
				)}
				<dl>
					<dt>Shape</dt>
					<dd>{PUZZLE_SHAPE_LABELS[selected.puzzle.shape]}</dd>
					<dt>Recipe</dt>
					<dd>{selected.puzzle.recipe.label}</dd>
					<dt>Palette</dt>
					<dd>{palette?.name ?? selected.row.palette_id}</dd>
					<dt>Group</dt>
					<dd>{selected.groupName ?? 'None'}</dd>
					<dt>Status</dt>
					<dd>{releaseStateLabel(selected.row)}</dd>
				</dl>
			</section>
		)
	}

	return (
		<section aria-labelledby="prepared-puzzles-title">
			<AdminSectionHeading
				id="prepared-puzzles-title"
				title={title}
				count={loading || catalog.error ? undefined : visible.length}
			>
				<AdminIconButton
					icon={faRotate}
					label="Refresh puzzles"
					disabled={loading}
					onClick={() => {
						setMessage('')
						void catalog.refresh().catch(() => {})
					}}
				/>
				<Select
					aria-label="Show purpose"
					value={purposeFilter}
					onChange={event => setPurposeFilter(event.target.value)}
				>
					<option value="all">All purposes</option>
					{PUZZLE_GROUP_PURPOSES.map(purpose => (
						<option key={purpose} value={purpose}>
							{puzzleGroupPurposeLabels[purpose]}
						</option>
					))}
				</Select>
				<Select
					aria-label="Show shape"
					value={shapeFilter}
					onChange={event => setShapeFilter(event.target.value)}
				>
					<option value="all">All shapes</option>
					{PUZZLE_SHAPE_IDS.map(shape => (
						<option key={shape} value={shape}>
							{PUZZLE_SHAPE_LABELS[shape]}
						</option>
					))}
				</Select>
				<Select
					aria-label="Show group"
					value={shownGroup}
					onChange={event => setGroupFilter(event.target.value)}
				>
					<option value="all">All groups</option>
					{groupOptions.map(([id, name]) => (
						<option key={id} value={id}>
							{name}
						</option>
					))}
				</Select>
			</AdminSectionHeading>
			<AdminFeedback
				error={
					catalog.error
						? errorMessage(catalog.error, fallbackError)
						: ''
				}
				status={message}
			/>
			{loading ? (
				<Loading
					label={
						catalog.refreshing
							? 'Refreshing puzzles…'
							: 'Loading puzzles…'
					}
				/>
			) : visible.length ? (
				<AdminGallery layout="puzzles">
					{visible.map(draft => {
						const palette = palettes.find(
							value => value.id === draft.row.palette_id,
						)
						const preview = palette
							? renderAuthoredPuzzle(draft.puzzle, palette)
							: null
						return (
							<AdminItemCard
								key={draft.row.id}
								label={`Puzzle ${draft.row.name}`}
								preview={
									preview ? (
										<span aria-hidden="true">
											<PuzzleBoard
												target
												shape={preview.shape}
												gridSize={preview.gridSize}
												colors={preview.target}
											/>
										</span>
									) : (
										<span>Palette unavailable</span>
									)
								}
								actions={
									<>
										<ReleaseStateIcon row={draft.row} />
										<AdminIconButton
											icon={
												status === 'scheduled'
													? faPenToSquare
													: faEye
											}
											tone="edit"
											label={`${status === 'scheduled' ? 'Edit' : 'View'} puzzle ${draft.row.name}`}
											onClick={() => {
												setMessage('')
												setSelectedId(draft.row.id)
											}}
										/>
									</>
								}
							>
								<strong>{draft.row.name}</strong>
								<span>
									{PUZZLE_SHAPE_LABELS[draft.puzzle.shape]}
								</span>
								<span>{draft.puzzle.recipe.label}</span>
								<span>{draft.groupName ?? 'Unassigned'}</span>
								{draft.groupPurpose && (
									<em>
										{
											puzzleGroupPurposeLabels[
												draft.groupPurpose
											]
										}
									</em>
								)}
							</AdminItemCard>
						)
					})}
				</AdminGallery>
			) : (
				<p>
					{inStatus.length
						? 'No puzzles match these filters.'
						: status === 'scheduled'
							? 'No puzzles are scheduled. Groups are scheduled from the Release tab, or from Puzzles > Groups.'
							: 'No puzzles are live yet.'}
				</p>
			)}
		</section>
	)
}
