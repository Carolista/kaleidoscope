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
	managePaletteSet,
	paletteSetLabels,
	type PaletteSet,
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
import { releaseState } from './releaseState'
import { PaletteSetLibrary } from '@/features/admin/palette-sets'
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
import { compareSetOrder, memberSetOrderKey } from '@/features/admin/sets'

const fallbackError = 'Unable to manage palettes.'

export default function PaletteLibrary({
	client,
	view = 'palettes',
	catalogStatus,
}: {
	readonly client: SupabaseClient<Database>
	readonly view?: 'sets' | 'palettes'
	readonly catalogStatus?: 'drafts' | 'assigned'
}) {
	const paletteCatalog = useCatalog('palettes', client, view === 'palettes')
	const setCatalog = useCatalog('paletteSets', client)
	const invalidate = useCatalogInvalidation()
	const palettes: readonly CatalogPalette[] = paletteCatalog.data ?? []
	const sets: readonly PaletteSet[] = setCatalog.data ?? []
	const loading = paletteCatalog.loading || setCatalog.loading
	const refreshing = paletteCatalog.refreshing || setCatalog.refreshing
	const catalogError =
		(view === 'palettes' && paletteCatalog.error) || setCatalog.error
	const error = catalogError ? errorMessage(catalogError, fallbackError) : ''
	const [status, setStatus] = useState('')
	const [filterChoice, setFilter] = useState('all')
	const [targetChoice, setTargetSet] = useState('')
	// Drop choices that no longer exist after the catalog changes.
	const filter =
		filterChoice === 'all' ||
		filterChoice === 'ungrouped' ||
		sets.some(set => set.row.id === filterChoice)
			? filterChoice
			: 'all'
	const targetSet = sets.some(
		set =>
			set.row.id === targetChoice &&
			!set.row.published_at &&
			!set.row.release_at,
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
		targetSet?: PaletteSet
	} | null>(null)
	// New palettes join the filtered set when it is still an editable draft.
	const filteredSet = sets.find(
		set =>
			set.row.id === filter &&
			!set.row.published_at &&
			!set.row.release_at,
	)
	const canCreate = catalogStatus !== 'assigned' || !!filteredSet
	const filteredPalettes = palettes.filter(palette => {
		const set = setOf(palette.id)
		return (
			(filter === 'all' ||
				(filter === 'ungrouped' ? !set : set?.row.id === filter)) &&
			(!catalogStatus ||
				(!palette.published_at &&
					!palette.release_at &&
					!!set === (catalogStatus === 'assigned')))
		)
	})
	const visiblePalettes =
		catalogStatus === 'assigned'
			? [...filteredPalettes].sort((a, b) =>
					compareSetOrder(
						memberSetOrderKey(a, sets),
						memberSetOrderKey(b, sets),
					),
				)
			: filteredPalettes
	const selection = useCheckedIds(visiblePalettes.map(palette => palette.id))
	const checked = selection.checked
	function setOf(id: string) {
		return sets.find(set => set.members.some(member => member.id === id))
	}
	// Only unassigned drafts may be deleted.
	function deletable(palette: CatalogPalette) {
		return (
			!palette.published_at && !palette.release_at && !setOf(palette.id)
		)
	}
	function refresh(preserveSelection = false, palettes = true) {
		if (!preserveSelection) selection.clear()
		void Promise.all([
			palettes && view === 'palettes' ? paletteCatalog.refresh() : null,
			setCatalog.refresh(),
		]).catch(() => {})
	}
	async function assign() {
		if (working.current || !targetSet || checked.size === 0) return
		working.current = true
		setBusy(true)
		setActionError('')
		try {
			await managePaletteSet(client, targetSet, {
				kind: 'assign',
				paletteIds: selection.ids,
			})
			setAssigning(null, () => {
				setStatus(
					'Palettes assigned. Previous draft set memberships were replaced.',
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
		const bySet = new Map<string, string[]>()
		for (const id of selection.ids) {
			const set = setOf(id)
			if (set)
				bySet.set(set.row.id, [...(bySet.get(set.row.id) ?? []), id])
		}
		try {
			// One request per set; a failure part-way leaves earlier sets unassigned.
			for (const [setId, paletteIds] of bySet)
				await managePaletteSet(client, setId, {
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
	if (view === 'sets')
		return (
			<PaletteSetLibrary
				client={client}
				sets={sets}
				loading={loading}
				refreshing={refreshing}
				catalogError={error}
				onChanged={() => refresh(false, false)}
				onOrderSaved={(setId, paletteIds) =>
					setCatalog.update(previous =>
						previous.map(set =>
							set.row.id === setId
								? {
										...set,
										members: paletteIds.flatMap(id =>
											set.members.filter(
												member => member.id === id,
											),
										),
									}
								: set,
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
				targetSet={editing.targetSet?.row}
				onSaved={message => {
					setStatus(message)
					setEditing(null)
					refresh()
					// Set thumbnails are rendered with current palette colors.
					invalidate('puzzleSets')
				}}
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
								targetSet: filteredSet,
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
					<Select
						id="palette-set-filter"
						aria-label="Show palettes"
						value={filter}
						disabled={loading || busy}
						onChange={event => {
							setFilter(event.target.value)
							selection.clear()
						}}
					>
						<option value="all">All sets</option>
						{catalogStatus !== 'assigned' && (
							<option value="ungrouped">No set</option>
						)}
						{sets.map(set => (
							<option key={set.row.id} value={set.row.id}>
								{set.row.name} ({paletteSetLabels[set.kind]})
							</option>
						))}
					</Select>
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
					title="Assign selected palettes to set"
					closeLabel="Close palette assignment"
					message={`Assign ${checked.size} selected palette${checked.size === 1 ? '' : 's'} to a set? Previous draft set memberships will be replaced.`}
					confirmLabel="Assign palettes"
					pending={busy ? 'Assigning palettes to set…' : null}
					error={actionError}
					confirmDisabled={loading || !!error || !targetSet}
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
					<FormField id="palette-assign-set" label="Palette set">
						{field => (
							<Select
								{...field}
								value={targetSet}
								disabled={busy}
								onChange={event =>
									setTargetSet(event.target.value)
								}
							>
								<option value="">Choose a draft set</option>
								{sets
									.filter(
										set =>
											!set.row.published_at &&
											!set.row.release_at,
									)
									.map(set => (
										<option
											key={set.row.id}
											value={set.row.id}
										>
											{set.row.name}
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
					message={`Remove ${checked.size} selected palette${checked.size === 1 ? '' : 's'} from their sets? Designs are unchanged.`}
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
			{!loading && !error && (
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
						label="Assign to set"
						disabled={busy}
						onClick={() => {
							setActionError('')
							setTargetSet('')
							setAssigning(true)
						}}
					/>
					{checkedPalettes.every(palette => !!setOf(palette.id)) && (
						<AdminIconButton
							icon={faLinkSlash}
							label="Unassign from sets"
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
							const state = releaseState(palette)
							const set = setOf(palette.id)
							return (
								<AdminItemCard
									key={palette.id}
									label={`Palette ${palette.name}`}
									selectLabel={`Select ${palette.name}`}
									selected={checked.has(palette.id)}
									selectDisabled={
										busy ||
										!!set?.row.published_at ||
										!!set?.row.release_at
									}
									onSelect={value =>
										selection.toggle(palette.id, value)
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
														targetSet: filteredSet,
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
									{state !== 'Draft' && <span>{state}</span>}
									{set && (
										<span>
											{set.row.name} ·{' '}
											{paletteSetLabels[set.kind]}
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
