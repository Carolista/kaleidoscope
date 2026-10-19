import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	faCopy,
	faEye,
	faPenToSquare,
	faPlusLarge,
	faRotate,
	faTrashCan,
	faLayerGroup,
} from '@fortawesome/pro-solid-svg-icons'
import type { Database } from '@/lib/supabase'
import type { Palette } from '@/domain/palettes'
import {
	bulkDeletePalettes,
	managePalette,
	readPalette,
	type CatalogPalette,
	loadPaletteUsage,
	type PaletteUsage,
	managePaletteSet,
	paletteSetLabels,
	type PaletteSet,
} from '@/features/admin/services'
import PaletteUsageDetails from './PaletteUsageDetails'
import {
	AdminIconButton,
	AdminFeedback,
	AdminGallery,
	AdminItemCard,
	AdminSectionHeading,
	AdminSelectionBar,
	useCheckedIds,
	AdminForm,
} from '@/features/admin/common'
import PaletteSandbox from './PaletteSandbox'
import { useUnsavedDraft } from '@/ui/navigation'
import styles from './PaletteLibrary.module.css'
import { PaletteSetLibrary } from '@/features/admin/palette-sets'
import { useCatalog, useCatalogInvalidation } from '@/features/admin/catalog'
import {
	Button,
	ConfirmDialog,
	FormField,
	Input,
	Loading,
	PaletteStrip,
	Select,
} from '@/ui/components'
import PaletteDeleteDialog from './PaletteDeleteDialog'
import { useModalState } from '@/ui/hooks'
import { compareSetOrder } from '@/features/admin/sets'

function errorMessage(cause: unknown): string {
	return cause instanceof Error ? cause.message : 'Unable to manage palettes.'
}

function releaseState(palette: CatalogPalette): string {
	if (!palette.published_at) return 'Draft'
	return palette.release_at && Date.parse(palette.release_at) > Date.now()
		? 'Scheduled'
		: 'Live'
}

function PaletteEditor({
	client,
	initial,
	startingColors,
	onSaved,
}: {
	readonly client: SupabaseClient<Database>
	readonly initial: CatalogPalette | null
	readonly startingColors: readonly string[]
	readonly onSaved: (message: string) => void
}) {
	const [name, setName] = useState(initial?.name ?? '')
	const [colors, setColors] = useState<readonly string[]>(startingColors)
	const [error, setError] = useState('')
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const working = useRef(false)
	const createRequest = useRef<{ id: string; content: string } | null>(null)
	const [usage, setUsage] = useState<PaletteUsage | null>(null)
	const [usageError, setUsageError] = useState('')
	const [usageLoading, setUsageLoading] = useState(!!initial)
	const readOnly = !!initial?.published_at || !!initial?.release_at
	const dirty =
		!readOnly &&
		(name !== (initial?.name ?? '') ||
			colors.some((color, index) => color !== startingColors[index]))
	useUnsavedDraft({ dirty, pending: busy })
	const validColors =
		colors.length === 5 &&
		colors.every(color => /^#[0-9a-f]{6}$/i.test(color))
			? readPalette({ id: initial?.id ?? 'preview', name, colors }).colors
			: null
	useEffect(() => {
		if (!initial) return
		let active = true
		void loadPaletteUsage(client, initial.id)
			.then(next => {
				if (active) setUsage(next)
			})
			.catch((cause: unknown) => {
				if (active) setUsageError(errorMessage(cause))
			})
			.finally(() => {
				if (active) setUsageLoading(false)
			})
		return () => {
			active = false
		}
	}, [client, initial])

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (working.current || readOnly) return
		if (!validColors || !name.trim()) {
			setError('Enter a name and five six-digit hex colors.')
			return
		}
		working.current = true
		setPending('Saving palette…')
		setError('')
		try {
			const palette = { name: name.trim(), colors: validColors }
			if (initial) {
				await managePalette(client, {
					kind: 'update',
					previous: initial,
					palette,
				})
			} else {
				const content = JSON.stringify(palette)
				if (createRequest.current?.content !== content)
					createRequest.current = { id: crypto.randomUUID(), content }
				await managePalette(client, {
					kind: 'create',
					id: createRequest.current.id,
					palette,
				})
			}
			onSaved(`Saved "${palette.name}" as a draft palette.`)
		} catch (cause) {
			setError(errorMessage(cause))
		} finally {
			working.current = false
			setPending(null)
		}
	}
	return (
		<section aria-labelledby="palette-editor-title">
			<h2 id="palette-editor-title">
				{initial
					? `${readOnly ? 'View' : 'Edit'} palette`
					: 'New palette'}
			</h2>
			{readOnly && (
				<p>{initial && releaseState(initial)} palette (read-only).</p>
			)}
			<AdminFeedback error={error} />
			{pending && <Loading label={pending} />}
			<div className={styles.editor}>
				<AdminForm
					onSubmit={save}
					aria-label={initial ? 'Edit palette' : 'Create palette'}
				>
					<div className={styles.nameRow}>
						<FormField label="Palette name" id="palette-name">
							{field => (
								<Input
									{...field}
									value={name}
									required
									disabled={busy || readOnly}
									onChange={event =>
										setName(event.target.value)
									}
								/>
							)}
						</FormField>
						{!readOnly && (
							<Button
								type="submit"
								variant="primary"
								disabled={
									busy ||
									!validColors ||
									!name.trim() ||
									(!!initial && !dirty)
								}
							>
								Save
							</Button>
						)}
					</div>
					<fieldset
						className={styles.colors}
						disabled={busy || readOnly}
					>
						<legend>Ordered colors</legend>
						{colors.map((color, index) => {
							const valid = /^#[0-9a-f]{6}$/i.test(color)
							function update(value: string) {
								setColors(previous =>
									previous.map((entry, slot) =>
										slot === index ? value : entry,
									),
								)
							}
							return (
								<div className={styles.colorRow} key={index}>
									<label htmlFor={`palette-color-${index}`}>
										Color {index + 1}
									</label>
									{valid ? (
										<Input
											type="color"
											value={color}
											aria-label={`Pick color ${index + 1}`}
											onChange={event =>
												update(event.target.value)
											}
										/>
									) : (
										<span
											className={styles.invalidSwatch}
											aria-hidden="true"
										>
											?
										</span>
									)}
									<Input
										id={`palette-color-${index}`}
										value={color}
										required
										pattern="#[0-9A-Fa-f]{6}"
										aria-invalid={!valid}
										aria-describedby={
											!valid
												? `palette-color-error-${index}`
												: undefined
										}
										spellCheck={false}
										onChange={event =>
											update(event.target.value)
										}
									/>
									{!valid && (
										<span
											id={`palette-color-error-${index}`}
											className={styles.colorError}
										>
											Use # and six hex digits.
										</span>
									)}
								</div>
							)
						})}
					</fieldset>
				</AdminForm>
				<PaletteSandbox colors={validColors} />
			</div>
			{initial && (
				<section aria-label="Palette usage">
					<AdminSectionHeading
						id="palette-usage-title"
						title="Usage"
						level={3}
					/>
					{usageLoading && <Loading label="Loading palette usage…" />}
					{usageError && <p role="alert">{usageError}</p>}
					{usage && !usageLoading && !usageError && (
						<PaletteUsageDetails
							usage={usage}
							colors={validColors}
						/>
					)}
				</section>
			)}
		</section>
	)
}

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
	const error = catalogError ? errorMessage(catalogError) : ''
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
	const [bulkDeleting, setBulkDeleting, bulkDeleteModal] =
		useModalState<true>()
	const [actionError, setActionError] = useState('')
	const working = useRef(false)
	useUnsavedDraft({ dirty: false, pending: busy })
	const [editing, setEditing] = useState<{
		palette: CatalogPalette | null
		startingColors?: Palette['colors']
	} | null>(null)
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
					compareSetOrder(setOrderKey(a), setOrderKey(b)),
				)
			: filteredPalettes
	const selection = useCheckedIds(visiblePalettes.map(palette => palette.id))
	const checked = selection.checked
	function setOf(id: string) {
		return sets.find(set => set.members.some(member => member.id === id))
	}
	function setOrderKey(palette: CatalogPalette) {
		const set = setOf(palette.id)
		return {
			setName: set?.row.name ?? null,
			position:
				set?.members.findIndex(member => member.id === palette.id) ??
				null,
			name: palette.name,
		}
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
			setActionError(errorMessage(cause))
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
			setActionError(errorMessage(cause))
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
				<AdminIconButton
					icon={faPlusLarge}
					label="New palette"
					disabled={busy || loading || !!error}
					onClick={() => {
						setStatus('')
						setEditing({ palette: null })
					}}
				/>
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
						<option value="ungrouped">No set</option>
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
