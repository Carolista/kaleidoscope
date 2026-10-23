import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	faCopy,
	faEye,
	faPenToSquare,
	faPlusLarge,
	faRotate,
	faTrashCan,
	faLayerGroup,
	faLinkSlash,
} from '@fortawesome/pro-solid-svg-icons'
import type { Database } from '@/lib/supabase'
import type { Palette } from '@/domain/palettes'
import {
	bulkDeletePalettes,
	type CatalogPalette,
	managePaletteGroup,
	PALETTE_GROUP_PURPOSES,
	paletteGroupPurposeLabels,
	type PaletteGroup,
	releaseStateOf,
} from '@/features/admin/services'
import {
	AdminIconButton,
	AdminFeedback,
	AdminGallery,
	AdminItemCard,
	AdminSectionHeading,
	AdminSelectionBar,
	useCheckedIds,
	errorMessage,
} from '@/features/admin/common'
import { useUnsavedDraft } from '@/ui/navigation'
import PaletteEditor from './PaletteEditor'
import { releaseStateLabel } from '@/features/admin/release'
import { PaletteGroupLibrary } from '@/features/admin/palette-groups'
import { useCatalog, useCatalogInvalidation } from '@/features/admin/catalog'
import {
	ConfirmDialog,
	FormField,
	Loading,
	PaletteStrip,
	Select,
} from '@/ui/components'
import PaletteDeleteDialog from './PaletteDeleteDialog'
import { useModalState } from '@/ui/hooks'
import { compareGroupOrder, memberGroupOrderKey } from '@/features/admin/groups'

const fallbackError = 'Unable to manage palettes.'

export default function PaletteLibrary({
	client,
	view = 'palettes',
	catalogStatus,
}: {
	readonly client: SupabaseClient<Database>
	readonly view?: 'groups' | 'palettes'
	readonly catalogStatus?: 'drafts' | 'assigned' | 'scheduled' | 'published'
}) {
	const paletteCatalog = useCatalog('palettes', client, view === 'palettes')
	const groupCatalog = useCatalog('paletteGroups', client)
	const invalidate = useCatalogInvalidation()
	const palettes: readonly CatalogPalette[] = paletteCatalog.data ?? []
	const groups: readonly PaletteGroup[] = groupCatalog.data ?? []
	const loading = paletteCatalog.loading || groupCatalog.loading
	const refreshing = paletteCatalog.refreshing || groupCatalog.refreshing
	const catalogError =
		(view === 'palettes' && paletteCatalog.error) || groupCatalog.error
	const error = catalogError ? errorMessage(catalogError, fallbackError) : ''
	const [status, setStatus] = useState('')
	const [purposeFilter, setPurposeFilter] = useState('all')
	const [filterChoice, setFilter] = useState('all')
	const [targetChoice, setTargetGroup] = useState('')
	const groupOptions = groups.filter(
		group => purposeFilter === 'all' || group.purpose === purposeFilter,
	)
	// Drop choices that no longer exist after the catalog or purpose changes.
	const filter =
		filterChoice === 'all' ||
		(filterChoice === 'ungrouped' && purposeFilter === 'all') ||
		groupOptions.some(group => group.row.id === filterChoice)
			? filterChoice
			: 'all'
	const targetGroup = groups.some(
		group =>
			group.row.id === targetChoice &&
			!group.row.published_at &&
			!group.row.release_at,
	)
		? targetChoice
		: ''
	const [busy, setBusy] = useState(false)
	const [deleting, setDeleting, deleteModal] = useModalState<CatalogPalette>()
	const [assigning, setAssigning, assignmentModal] = useModalState<true>()
	const [unassigning, setUnassigning, unassignModal] = useModalState<true>()
	const [bulkDeleting, setBulkDeleting, bulkDeleteModal] =
		useModalState<true>()
	const [actionError, setActionError] = useState('')
	const working = useRef(false)
	useUnsavedDraft({ dirty: false, pending: busy })
	const [editing, setEditing] = useState<{
		palette: CatalogPalette | null
		startingColors?: Palette['colors']
		targetGroup?: PaletteGroup
	} | null>(null)
	// New palettes join the filtered group when it is still an editable draft.
	const filteredGroup = groups.find(
		group =>
			group.row.id === filter &&
			!group.row.published_at &&
			!group.row.release_at,
	)
	const prepared =
		catalogStatus === 'scheduled' || catalogStatus === 'published'
	const canCreate =
		!prepared && (catalogStatus !== 'assigned' || !!filteredGroup)
	const filteredPalettes = palettes.filter(palette => {
		const group = groupOf(palette.id)
		return (
			(purposeFilter === 'all' || group?.purpose === purposeFilter) &&
			(filter === 'all' ||
				(filter === 'ungrouped' ? !group : group?.row.id === filter)) &&
			(!catalogStatus ||
				(prepared
					? releaseStateOf(palette) ===
						(catalogStatus === 'scheduled' ? 'scheduled' : 'live')
					: !palette.published_at &&
						!palette.release_at &&
						!!group === (catalogStatus === 'assigned')))
		)
	})
	const visiblePalettes =
		catalogStatus === 'assigned'
			? [...filteredPalettes].sort((a, b) =>
					compareGroupOrder(
						memberGroupOrderKey(a, groups),
						memberGroupOrderKey(b, groups),
					),
				)
			: filteredPalettes
	const selection = useCheckedIds(visiblePalettes.map(palette => palette.id))
	const checked = selection.checked
	function groupOf(id: string) {
		return groups.find(group =>
			group.members.some(member => member.id === id),
		)
	}
	// Only unassigned drafts may be deleted.
	function deletable(palette: CatalogPalette) {
		return (
			!palette.published_at && !palette.release_at && !groupOf(palette.id)
		)
	}
	function refresh(preserveSelection = false, palettes = true) {
		if (!preserveSelection) selection.clear()
		void Promise.all([
			palettes && view === 'palettes' ? paletteCatalog.refresh() : null,
			groupCatalog.refresh(),
		]).catch(() => {})
	}
	async function assign() {
		if (working.current || !targetGroup || checked.size === 0) return
		working.current = true
		setBusy(true)
		setActionError('')
		try {
			await managePaletteGroup(client, targetGroup, {
				kind: 'assign',
				paletteIds: selection.ids,
			})
			setAssigning(null, () => {
				setStatus(
					'Palettes assigned. Previous draft group memberships were replaced.',
				)
				refresh(false, false)
			})
		} catch (cause) {
			setActionError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setBusy(false)
		}
	}
	async function unassign() {
		if (working.current || checked.size === 0) return
		working.current = true
		setBusy(true)
		setActionError('')
		const count = checked.size
		const byGroup = new Map<string, string[]>()
		for (const id of selection.ids) {
			const group = groupOf(id)
			if (group)
				byGroup.set(group.row.id, [
					...(byGroup.get(group.row.id) ?? []),
					id,
				])
		}
		try {
			// One request per group; a failure part-way leaves earlier groups unassigned.
			for (const [groupId, paletteIds] of byGroup)
				await managePaletteGroup(client, groupId, {
					kind: 'remove',
					paletteIds,
				})
			setUnassigning(null, () => {
				setStatus(
					`Unassigned ${count} palette${count === 1 ? '' : 's'}. Designs are unchanged.`,
				)
				refresh(false, false)
			})
		} catch (cause) {
			setActionError(errorMessage(cause, fallbackError))
			refresh(true, false)
		} finally {
			working.current = false
			setBusy(false)
		}
	}
	async function deleteSelected() {
		if (working.current || checked.size === 0) return
		working.current = true
		setBusy(true)
		setActionError('')
		const count = checked.size
		try {
			await bulkDeletePalettes(client, selection.ids)
			setBulkDeleting(null, () => {
				setStatus(`Deleted ${count} palette${count === 1 ? '' : 's'}.`)
				refresh()
			})
		} catch (cause) {
			setActionError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setBusy(false)
		}
	}
	const checkedPalettes = palettes.filter(palette => checked.has(palette.id))
	if (view === 'groups')
		return (
			<PaletteGroupLibrary
				client={client}
				groups={groups}
				loading={loading}
				refreshing={refreshing}
				catalogError={error}
				onChanged={() => refresh(false, false)}
				onOrderSaved={(groupId, paletteIds) =>
					groupCatalog.update(previous =>
						previous.map(group =>
							group.row.id === groupId
								? {
										...group,
										members: paletteIds.flatMap(id =>
											group.members.filter(
												member => member.id === id,
											),
										),
									}
								: group,
						),
					)
				}
			/>
		)
	if (editing) {
		return (
			<PaletteEditor
				client={client}
				initial={editing.palette}
				startingColors={
					editing.startingColors ??
					editing.palette?.colors ??
					palettes[0]?.colors ?? [
						'#ffffff',
						'#ffffff',
						'#ffffff',
						'#ffffff',
						'#ffffff',
					]
				}
				targetGroup={editing.targetGroup?.row}
				onSaved={message => {
					setStatus(message)
					setEditing(null)
					refresh()
					// Group thumbnails are rendered with current palette colors.
					invalidate('puzzleGroups')
				}}
				onCancel={() => setEditing(null)}
			/>
		)
	}
	return (
		<section aria-labelledby="palette-library-title">
			<AdminSectionHeading
				id="palette-library-title"
				title={
					catalogStatus === 'assigned'
						? 'Assigned palettes'
						: catalogStatus === 'scheduled'
							? 'Scheduled palettes'
							: catalogStatus === 'published'
								? 'Published palettes'
								: 'Palettes'
				}
			>
				{canCreate && (
					<AdminIconButton
						icon={faPlusLarge}
						label="New palette"
						disabled={busy || loading || !!error}
						onClick={() => {
							setStatus('')
							setEditing({
								palette: null,
								targetGroup: filteredGroup,
							})
						}}
					/>
				)}
				<AdminIconButton
					icon={faRotate}
					label="Refresh palette catalog"
					disabled={busy || loading}
					onClick={() => refresh()}
				/>
				{catalogStatus !== 'drafts' && (
					<>
						<Select
							id="palette-purpose-filter"
							aria-label="Show purpose"
							value={purposeFilter}
							disabled={loading || busy}
							onChange={event => {
								setPurposeFilter(event.target.value)
								selection.clear()
							}}
						>
							<option value="all">All purposes</option>
							{PALETTE_GROUP_PURPOSES.map(purpose => (
								<option key={purpose} value={purpose}>
									{paletteGroupPurposeLabels[purpose]}
								</option>
							))}
						</Select>
						<Select
							id="palette-group-filter"
							aria-label="Show palettes"
							value={filter}
							disabled={loading || busy}
							onChange={event => {
								setFilter(event.target.value)
								selection.clear()
							}}
						>
							<option value="all">All groups</option>
							{catalogStatus !== 'assigned' &&
								purposeFilter === 'all' && (
									<option value="ungrouped">No group</option>
								)}
							{groupOptions.map(group => (
								<option key={group.row.id} value={group.row.id}>
									{group.row.name} (
									{paletteGroupPurposeLabels[group.purpose]})
								</option>
							))}
						</Select>
					</>
				)}
			</AdminSectionHeading>
			<AdminFeedback error={error} status={status} />
			{deleting && (
				<PaletteDeleteDialog
					{...deleteModal}
					client={client}
					palette={deleting}
					onCancel={() => setDeleting(null)}
					onDeleted={() => {
						setDeleting(null, () => {
							setStatus(`Deleted "${deleting.name}".`)
							refresh(true)
						})
					}}
				/>
			)}
			{assigning && (
				<ConfirmDialog
					{...assignmentModal}
					title="Assign selected palettes to group"
					closeLabel="Close palette assignment"
					message={`Assign ${checked.size} selected palette${checked.size === 1 ? '' : 's'} to a group? Previous draft group memberships will be replaced.`}
					confirmLabel="Assign palettes"
					pending={busy ? 'Assigning palettes to group…' : null}
					error={actionError}
					confirmDisabled={loading || !!error || !targetGroup}
					onConfirm={() => {
						void assign()
					}}
					onCancel={() => setAssigning(null)}
				>
					<ul>
						{checkedPalettes.map(palette => (
							<li key={palette.id}>{palette.name}</li>
						))}
					</ul>
					<FormField id="palette-assign-group" label="Palette group">
						{field => (
							<Select
								{...field}
								value={targetGroup}
								disabled={busy}
								onChange={event =>
									setTargetGroup(event.target.value)
								}
							>
								<option value="">Choose a draft group</option>
								{groups
									.filter(
										group =>
											!group.row.published_at &&
											!group.row.release_at,
									)
									.map(group => (
										<option
											key={group.row.id}
											value={group.row.id}
										>
											{group.row.name}
										</option>
									))}
							</Select>
						)}
					</FormField>
				</ConfirmDialog>
			)}
			{unassigning && (
				<ConfirmDialog
					{...unassignModal}
					title="Unassign selected palettes"
					closeLabel="Close palette unassignment"
					message={`Remove ${checked.size} selected palette${checked.size === 1 ? '' : 's'} from their groups? Designs are unchanged.`}
					confirmLabel="Unassign palettes"
					pending={busy ? 'Unassigning palettes…' : null}
					error={actionError}
					confirmDisabled={loading || !!error || checked.size === 0}
					onConfirm={() => {
						void unassign()
					}}
					onCancel={() => setUnassigning(null)}
				>
					<ul>
						{checkedPalettes.map(palette => (
							<li key={palette.id}>{palette.name}</li>
						))}
					</ul>
				</ConfirmDialog>
			)}
			{bulkDeleting && (
				<ConfirmDialog
					{...bulkDeleteModal}
					title="Delete selected palettes"
					closeLabel="Close bulk palette deletion"
					destructive
					message={`Permanently delete ${checked.size} selected palette${checked.size === 1 ? '' : 's'}?`}
					confirmLabel="Delete palettes"
					pending={busy ? 'Deleting palettes…' : null}
					error={actionError}
					confirmDisabled={loading || !!error || checked.size === 0}
					onConfirm={() => {
						void deleteSelected()
					}}
					onCancel={() => setBulkDeleting(null)}
				>
					<ul>
						{checkedPalettes.map(palette => (
							<li key={palette.id}>{palette.name}</li>
						))}
					</ul>
				</ConfirmDialog>
			)}
			{loading && (
				<Loading
					label={
						refreshing
							? 'Refreshing palettes…'
							: 'Loading palettes…'
					}
				/>
			)}
			{!loading && !error && !prepared && (
				<AdminSelectionBar
					label="Bulk palette actions"
					shown={visiblePalettes.length}
					checked={checked.size}
					disabled={busy}
					onSelectAll={selection.setAll}
					onClear={selection.clear}
				>
					<AdminIconButton
						icon={faLayerGroup}
						label="Assign to group"
						disabled={busy}
						onClick={() => {
							setActionError('')
							setTargetGroup('')
							setAssigning(true)
						}}
					/>
					{checkedPalettes.every(
						palette => !!groupOf(palette.id),
					) && (
						<AdminIconButton
							icon={faLinkSlash}
							label="Unassign from groups"
							disabled={busy}
							onClick={() => {
								setActionError('')
								setUnassigning(true)
							}}
						/>
					)}
					{checkedPalettes.every(deletable) && (
						<AdminIconButton
							icon={faTrashCan}
							label="Delete selected"
							disabled={busy}
							onClick={() => {
								setActionError('')
								setBulkDeleting(true)
							}}
						/>
					)}
				</AdminSelectionBar>
			)}
			{!loading &&
				!error &&
				(visiblePalettes.length ? (
					<AdminGallery layout="palettes">
						{visiblePalettes.map(palette => {
							const group = groupOf(palette.id)
							return (
								<AdminItemCard
									key={palette.id}
									label={`Palette ${palette.name}`}
									selectLabel={`Select ${palette.name}`}
									selected={checked.has(palette.id)}
									selectDisabled={
										busy ||
										!!group?.row.published_at ||
										!!group?.row.release_at
									}
									onSelect={
										prepared
											? undefined
											: value =>
													selection.toggle(
														palette.id,
														value,
													)
									}
									preview={
										<PaletteStrip
											colors={palette.colors}
											variant="continuous"
										/>
									}
									actions={
										<>
											<AdminIconButton
												icon={faCopy}
												label={`Duplicate ${palette.name}`}
												disabled={busy}
												onClick={() => {
													setStatus('')
													setEditing({
														palette: null,
														startingColors:
															palette.colors,
														targetGroup:
															filteredGroup,
													})
												}}
											/>
											<AdminIconButton
												icon={
													palette.published_at
														? faEye
														: faPenToSquare
												}
												label={`${palette.published_at ? 'View' : 'Edit'} ${palette.name}`}
												disabled={busy}
												tone="edit"
												onClick={() => {
													setStatus('')
													setEditing({ palette })
												}}
											/>
											{deletable(palette) && (
												<AdminIconButton
													icon={faTrashCan}
													label={`Delete ${palette.name}`}
													tone="delete"
													disabled={busy}
													onClick={() => {
														setStatus('')
														setDeleting(palette)
													}}
												/>
											)}
										</>
									}
								>
									<strong>{palette.name}</strong>
									{releaseStateLabel(palette) && (
										<span>
											{releaseStateLabel(palette)}
										</span>
									)}
									{group && (
										<span>
											{group.row.name} ·{' '}
											{
												paletteGroupPurposeLabels[
													group.purpose
												]
											}
										</span>
									)}
								</AdminItemCard>
							)
						})}
					</AdminGallery>
				) : (
					<p>
						{palettes.length
							? 'No palettes match this view.'
							: 'No palettes yet. Create a draft to get started.'}
					</p>
				))}
		</section>
	)
}
