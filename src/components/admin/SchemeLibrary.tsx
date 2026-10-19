import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	faCopy,
	faEye,
	faPenToSquare,
	faPlusLarge,
	faRotate,
	faSquareArrowLeft,
	faTrashCan,
	faXmark,
} from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Database } from '../../types/database'
import type { ColorScheme } from '../../types/colorScheme'
import {
	manageColorScheme,
	readColorScheme,
	type CatalogScheme,
} from '../../services/colorSchemes'
import {
	loadSchemeUsage,
	schemeIsUsed,
	type SchemeUsage,
} from '../../services/schemeUsage'
import PaletteUsageDetails from './PaletteUsageDetails'
import AdminIconButton from './AdminIconButton'
import SchemeSandbox from './SchemeSandbox'
import useUnsavedDraft from './useUnsavedDraft'
import { useNavigationGuard } from './useNavigationGuard'
import adminStyles from './AdminPortal.module.css'
import styles from './SchemeLibrary.module.css'
import Checkbox from '../shared/Checkbox'
import {
	manageSchemeSet,
	schemeSetLabels,
	type SchemeSet,
} from '../../services/schemeSets'
import SchemeSetLibrary from './SchemeSetLibrary'
import { useCatalog, useCatalogInvalidation } from './useAdminCatalog'
import {
	Button,
	ConfirmDialog,
	FormField,
	Input,
	Loading,
	PaletteStrip,
	Select,
} from '@shared'
import { AdminFeedback, AdminGallery, AdminSectionHeading } from './AdminLayout'
import PaletteDeleteDialog from './PaletteDeleteDialog'
import useModalState from '../../hooks/useModalState'

function errorMessage(cause: unknown): string {
	return cause instanceof Error ? cause.message : 'Unable to manage palettes.'
}

function releaseState(scheme: CatalogScheme): string {
	if (!scheme.published_at) return 'Draft'
	return scheme.release_at && Date.parse(scheme.release_at) > Date.now()
		? 'Scheduled'
		: 'Live'
}

function SchemeEditor({
	client,
	initial,
	startingColors,
	onBack,
	onSaved,
}: {
	readonly client: SupabaseClient<Database>
	readonly initial: CatalogScheme | null
	readonly startingColors: readonly string[]
	readonly onBack: () => void
	readonly onSaved: (message: string) => void
}) {
	const [name, setName] = useState(initial?.name ?? '')
	const [colors, setColors] = useState<readonly string[]>(startingColors)
	const [error, setError] = useState('')
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const working = useRef(false)
	const createRequest = useRef<{ id: string; content: string } | null>(null)
	const [confirmDelete, setConfirmDelete, editorDeleteModal] =
		useModalState<true>()
	const [usage, setUsage] = useState<SchemeUsage | null>(null)
	const [usageError, setUsageError] = useState('')
	const [usageReload, setUsageReload] = useState(0)
	const [usageLoading, setUsageLoading] = useState(!!initial)
	const readOnly = !!initial?.published_at || !!initial?.release_at
	const dirty =
		!readOnly &&
		(name !== (initial?.name ?? '') ||
			colors.some((color, index) => color !== startingColors[index]))
	useUnsavedDraft({ dirty, pending: busy })
	const { requestNavigation } = useNavigationGuard()
	const validColors =
		colors.length === 5 &&
		colors.every(color => /^#[0-9a-f]{6}$/i.test(color))
			? readColorScheme({ id: initial?.id ?? 'preview', name, colors })
					.colors
			: null
	useEffect(() => {
		if (!initial) return
		let active = true
		void loadSchemeUsage(client, initial.id)
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
	}, [client, initial, usageReload])
	const canDelete =
		!!initial &&
		!readOnly &&
		!!usage &&
		!usageLoading &&
		!usageError &&
		!schemeIsUsed(usage)

	function back() {
		requestNavigation(onBack)
	}
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
			const scheme = { name: name.trim(), colors: validColors }
			if (initial) {
				await manageColorScheme(client, {
					kind: 'update',
					previous: initial,
					scheme,
				})
			} else {
				const content = JSON.stringify(scheme)
				if (createRequest.current?.content !== content)
					createRequest.current = { id: crypto.randomUUID(), content }
				await manageColorScheme(client, {
					kind: 'create',
					id: createRequest.current.id,
					scheme,
				})
			}
			onSaved(`Saved "${scheme.name}" as a draft palette.`)
		} catch (cause) {
			setError(errorMessage(cause))
		} finally {
			working.current = false
			setPending(null)
		}
	}
	return (
		<section aria-labelledby="scheme-editor-title">
			<Button
				variant="link"
				type="button"
				className={adminStyles.backLink}
				disabled={busy}
				onClick={back}
			>
				<FontAwesomeIcon icon={faSquareArrowLeft} aria-hidden="true" />{' '}
				Back to palettes
			</Button>
			<h2 id="scheme-editor-title">
				{initial
					? `${readOnly ? 'View' : 'Edit'} palette`
					: 'New palette'}
			</h2>
			{readOnly && (
				<p>
					{initial && releaseState(initial)} palette. Publishing and
					color corrections are managed separately; this view is
					read-only.
				</p>
			)}
			{initial && (
				<p className={styles.help}>
					Palette ID: {initial.id} · Color revision:{' '}
					{initial.revision}
				</p>
			)}
			<AdminFeedback error={error} />
			{pending && <Loading label={pending} />}
			<div className={styles.editor}>
				<form
					onSubmit={save}
					className={adminStyles.form}
					aria-label={initial ? 'Edit palette' : 'Create palette'}
				>
					<FormField label="Palette name" id="scheme-name">
						{field => (
							<Input
								{...field}
								value={name}
								required
								disabled={busy || readOnly}
								onChange={event => setName(event.target.value)}
							/>
						)}
					</FormField>
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
									<label htmlFor={`scheme-color-${index}`}>
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
										id={`scheme-color-${index}`}
										value={color}
										required
										pattern="#[0-9A-Fa-f]{6}"
										aria-invalid={!valid}
										aria-describedby={
											!valid
												? `scheme-color-error-${index}`
												: undefined
										}
										spellCheck={false}
										onChange={event =>
											update(event.target.value)
										}
									/>
									{!valid && (
										<span
											id={`scheme-color-error-${index}`}
											className={styles.colorError}
										>
											Use # and six hex digits.
										</span>
									)}
								</div>
							)
						})}
					</fieldset>
					<p className={styles.help}>
						Slot order is used by saved puzzles. Saving colors
						updates their appearance without changing their designs.
					</p>
					{!readOnly && (
						<Button
							type="submit"
							disabled={
								busy ||
								!validColors ||
								!name.trim() ||
								(!!initial && !dirty)
							}
						>
							Save palette
						</Button>
					)}
				</form>
				<SchemeSandbox colors={validColors} />
			</div>
			{initial && (
				<section aria-label="Palette usage">
					<AdminSectionHeading
						id="scheme-usage-title"
						title="Usage"
						level={3}
					>
						<AdminIconButton
							icon={faRotate}
							label="Refresh palette usage"
							disabled={busy || usageLoading}
							onClick={() => {
								setUsageLoading(true)
								setUsageError('')
								setUsageReload(value => value + 1)
							}}
						/>
					</AdminSectionHeading>
					{usageLoading && (
						<Loading
							label={
								usageReload > 0
									? 'Refreshing palette usage…'
									: 'Loading palette usage…'
							}
						/>
					)}
					{usageError && (
						<p role="alert">
							{usageError} Deletion is disabled until usage can be
							checked.
						</p>
					)}
					{usage && !usageLoading && !usageError && (
						<PaletteUsageDetails
							usage={usage}
							colors={validColors}
						/>
					)}
					{!readOnly && (
						<>
							<Button
								type="button"
								className={styles.deleteButton}
								disabled={busy || !canDelete}
								onClick={() => setConfirmDelete(true)}
							>
								Delete palette
							</Button>
							{confirmDelete && (
								<PaletteDeleteDialog
									{...editorDeleteModal}
									client={client}
									scheme={initial}
									dirty={dirty}
									onCancel={() => setConfirmDelete(null)}
									onDeleted={() =>
										setConfirmDelete(null, () =>
											onSaved(
												`Deleted "${initial.name}".`,
											),
										)
									}
								/>
							)}
						</>
					)}
				</section>
			)}
		</section>
	)
}

export default function SchemeLibrary({
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
	const schemes: readonly CatalogScheme[] = paletteCatalog.data ?? []
	const sets: readonly SchemeSet[] = setCatalog.data ?? []
	const loading = paletteCatalog.loading || setCatalog.loading
	const refreshing = paletteCatalog.refreshing || setCatalog.refreshing
	const catalogError =
		(view === 'palettes' && paletteCatalog.error) || setCatalog.error
	const error = catalogError ? errorMessage(catalogError) : ''
	const [status, setStatus] = useState('')
	const [filterChoice, setFilter] = useState('all')
	const [checkedChoice, setChecked] = useState<ReadonlySet<string>>(new Set())
	const [targetChoice, setTargetSet] = useState('')
	// Drop choices that no longer exist after the catalog changes.
	const filter =
		filterChoice === 'all' ||
		filterChoice === 'ungrouped' ||
		sets.some(set => set.row.id === filterChoice)
			? filterChoice
			: 'all'
	const checked: ReadonlySet<string> = new Set(
		[...checkedChoice].filter(id =>
			schemes.some(scheme => scheme.id === id),
		),
	)
	const targetSet = sets.some(
		set =>
			set.row.id === targetChoice &&
			!set.row.published_at &&
			!set.row.release_at,
	)
		? targetChoice
		: ''
	const [busy, setBusy] = useState(false)
	const [deleting, setDeleting, deleteModal] = useModalState<CatalogScheme>()
	const [assigning, setAssigning, assignmentModal] = useModalState<true>()
	const [actionError, setActionError] = useState('')
	const working = useRef(false)
	useUnsavedDraft({ dirty: false, pending: busy })
	const [editing, setEditing] = useState<{
		scheme: CatalogScheme | null
		startingColors?: ColorScheme['colors']
	} | null>(null)
	function refresh(preserveSelection = false, palettes = true) {
		if (!preserveSelection) setChecked(new Set())
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
			await manageSchemeSet(client, targetSet, {
				kind: 'assign',
				paletteIds: [...checked],
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
	if (view === 'sets')
		return (
			<SchemeSetLibrary
				client={client}
				sets={sets}
				loading={loading}
				refreshing={refreshing}
				catalogError={error}
				onChanged={() => refresh(false, false)}
			/>
		)
	if (editing) {
		return (
			<SchemeEditor
				client={client}
				initial={editing.scheme}
				startingColors={
					editing.startingColors ??
					editing.scheme?.colors ??
					schemes[0]?.colors ?? [
						'#ffffff',
						'#ffffff',
						'#ffffff',
						'#ffffff',
						'#ffffff',
					]
				}
				onBack={() => setEditing(null)}
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
	const visibleSchemes = schemes.filter(scheme => {
		const set = sets.find(set =>
			set.members.some(member => member.id === scheme.id),
		)
		return (
			(filter === 'all' ||
				(filter === 'ungrouped' ? !set : set?.row.id === filter)) &&
			(!catalogStatus ||
				(!scheme.published_at &&
					!scheme.release_at &&
					!!set === (catalogStatus === 'assigned')))
		)
	})
	return (
		<section aria-labelledby="scheme-library-title">
			<AdminSectionHeading
				id="scheme-library-title"
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
						setEditing({ scheme: null })
					}}
				/>
				<AdminIconButton
					icon={faRotate}
					label="Refresh palette catalog"
					disabled={busy || loading}
					onClick={() => refresh()}
				/>
			</AdminSectionHeading>
			<p>
				Organize palettes in sets without changing starter offerings,
				rewards, puzzle usage, or store access.
			</p>
			<div className={styles.organize}>
				<label htmlFor="scheme-set-filter">Show palettes</label>
				<Select
					id="scheme-set-filter"
					value={filter}
					disabled={loading || busy}
					onChange={event => {
						setFilter(event.target.value)
						setChecked(new Set())
					}}
				>
					<option value="all">All palettes</option>
					<option value="ungrouped">Ungrouped</option>
					{sets.map(set => (
						<option key={set.row.id} value={set.row.id}>
							{set.row.name} ({schemeSetLabels[set.kind]})
						</option>
					))}
				</Select>
				<label htmlFor="scheme-assign-set">
					Assign selected to set
				</label>
				<Select
					id="scheme-assign-set"
					value={targetSet}
					disabled={loading || busy}
					onChange={event => setTargetSet(event.target.value)}
				>
					<option value="">Choose a draft set</option>
					{sets
						.filter(
							set => !set.row.published_at && !set.row.release_at,
						)
						.map(set => (
							<option key={set.row.id} value={set.row.id}>
								{set.row.name}
							</option>
						))}
				</Select>
				<Button
					type="button"
					disabled={
						loading || busy || !targetSet || checked.size === 0
					}
					onClick={() => {
						setActionError('')
						setAssigning(true)
					}}
				>
					Assign {checked.size} selected
				</Button>
				{checked.size > 0 && (
					<AdminIconButton
						icon={faXmark}
						label="Clear selection"
						disabled={busy}
						onClick={() => setChecked(new Set())}
					/>
				)}
			</div>
			<AdminFeedback error={error} status={status} />
			{deleting && (
				<PaletteDeleteDialog
					{...deleteModal}
					client={client}
					scheme={deleting}
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
					message={`Assign ${checked.size} selected palettes to "${sets.find(set => set.row.id === targetSet)?.row.name}"? Previous draft set memberships will be replaced.`}
					confirmLabel="Assign palettes"
					pending={busy ? 'Assigning palettes to set…' : null}
					error={actionError}
					confirmDisabled={loading || !!error}
					onConfirm={() => {
						void assign()
					}}
					onCancel={() => setAssigning(null)}
				>
					<ul>
						{schemes
							.filter(scheme => checked.has(scheme.id))
							.map(scheme => (
								<li key={scheme.id}>{scheme.name}</li>
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
			{!loading &&
				!error &&
				(visibleSchemes.length ? (
					<AdminGallery layout="palettes">
						{visibleSchemes.map(scheme => (
							<li
								className={styles.card}
								key={scheme.id}
								aria-label={`Palette ${scheme.name}`}
							>
								<PaletteStrip
									colors={scheme.colors}
									variant="continuous"
								/>
								<strong>{scheme.name}</strong>
								<Checkbox
									plain
									hideLabel
									label={`Select ${scheme.name}`}
									checked={checked.has(scheme.id)}
									disabled={
										busy ||
										sets.some(
											set =>
												(set.row.published_at ||
													set.row.release_at) &&
												set.members.some(
													member =>
														member.id === scheme.id,
												),
										)
									}
									onChange={value => {
										setChecked(previous => {
											const next = new Set(previous)
											if (value) next.add(scheme.id)
											else next.delete(scheme.id)
											return next
										})
									}}
								/>
								<span>{releaseState(scheme)}</span>
								{sets
									.filter(set =>
										set.members.some(
											member => member.id === scheme.id,
										),
									)
									.map(set => (
										<span key={set.row.id}>
											{set.row.name} ·{' '}
											{schemeSetLabels[set.kind]}
										</span>
									))}
								<div className={styles.actions}>
									<AdminIconButton
										icon={faCopy}
										label={`Duplicate ${scheme.name}`}
										disabled={busy}
										onClick={() => {
											setStatus('')
											setEditing({
												scheme: null,
												startingColors: scheme.colors,
											})
										}}
									/>
									<AdminIconButton
										icon={
											scheme.published_at
												? faEye
												: faPenToSquare
										}
										label={`${scheme.published_at ? 'View' : 'Edit'} ${scheme.name}`}
										disabled={busy}
										className={adminStyles.editAction}
										onClick={() => {
											setStatus('')
											setEditing({
												scheme,
											})
										}}
									/>
									<AdminIconButton
										icon={faTrashCan}
										label={`Delete ${scheme.name}`}
										className={adminStyles.deleteAction}
										disabled={
											busy ||
											!!scheme.published_at ||
											!!scheme.release_at
										}
										onClick={() => {
											setStatus('')
											setDeleting(scheme)
										}}
									/>
								</div>
							</li>
						))}
					</AdminGallery>
				) : (
					<p>
						{schemes.length
							? 'No palettes match this view.'
							: 'No palettes yet. Create a draft to get started.'}
					</p>
				))}
		</section>
	)
}
