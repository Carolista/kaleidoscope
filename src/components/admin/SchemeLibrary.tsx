import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
	faCopy,
	faLayerGroup,
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
	loadColorSchemes,
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
import useUnsavedDraft, { confirmDiscardDraft } from './useUnsavedDraft'
import adminStyles from './AdminPortal.module.css'
import styles from './SchemeLibrary.module.css'
import Checkbox from '../shared/Checkbox'
import {
	loadSchemeSets,
	manageSchemeSet,
	schemeSetLabels,
	type SchemeSet,
} from '../../services/schemeSets'
import SchemeSetLibrary from './SchemeSetLibrary'
import { Button, ConfirmDialog, Input, Loading, Select } from '@shared'
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

function Swatches({ colors }: { readonly colors: readonly string[] }) {
	return (
		<span className={styles.swatches} aria-hidden="true">
			{colors.map((color, index) => (
				<span key={index} style={{ backgroundColor: color }} />
			))}
		</span>
	)
}

function SchemeEditor({
	client,
	initial,
	startingColors,
	onBack,
	onSaved,
	onDirtyChange,
}: {
	readonly client: SupabaseClient<Database>
	readonly initial: CatalogScheme | null
	readonly startingColors: readonly string[]
	readonly onBack: () => void
	readonly onSaved: (message: string) => void
	readonly onDirtyChange?: (dirty: boolean) => void
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
	const [deleteBusy, setDeleteBusy] = useState(false)
	const [usage, setUsage] = useState<SchemeUsage | null>(null)
	const [usageError, setUsageError] = useState('')
	const [usageReload, setUsageReload] = useState(0)
	const [usageLoading, setUsageLoading] = useState(!!initial)
	const readOnly = !!initial?.published_at || !!initial?.release_at
	const dirty =
		!readOnly &&
		(name !== (initial?.name ?? '') ||
			colors.some((color, index) => color !== startingColors[index]))
	useUnsavedDraft(dirty || busy || deleteBusy, onDirtyChange)
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
		if (!busy && (!dirty || confirmDiscardDraft())) onBack()
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
			{error && <p role="alert">{error}</p>}
			{pending && <Loading label={pending} />}
			<div className={styles.editor}>
				<form
					onSubmit={save}
					className={adminStyles.form}
					aria-label={initial ? 'Edit palette' : 'Create palette'}
				>
					<div className={adminStyles.metadataField}>
						<label htmlFor="scheme-name">Palette name</label>
						<Input
							id="scheme-name"
							value={name}
							required
							disabled={busy || readOnly}
							onChange={event => setName(event.target.value)}
						/>
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
					<div className={styles.heading}>
						<h3>Usage</h3>
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
					</div>
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
									onDirtyChange={setDeleteBusy}
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
	onBack,
	onDirtyChange,
}: {
	readonly client: SupabaseClient<Database>
	readonly onBack: () => void
	readonly onDirtyChange?: (dirty: boolean) => void
}) {
	const [schemes, setSchemes] = useState<readonly CatalogScheme[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [status, setStatus] = useState('')
	const [reload, setReload] = useState(0)
	const [sets, setSets] = useState<readonly SchemeSet[]>([])
	const [showSets, setShowSets] = useState(false)
	const [filter, setFilter] = useState('all')
	const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
	const [targetSet, setTargetSet] = useState('')
	const [busy, setBusy] = useState(false)
	const [deleting, setDeleting, deleteModal] = useModalState<CatalogScheme>()
	const [assigning, setAssigning, assignmentModal] = useModalState<true>()
	const [actionError, setActionError] = useState('')
	const [deleteBusy, setDeleteBusy] = useState(false)
	const working = useRef(false)
	const [childDirty, setChildDirty] = useState(false)
	useUnsavedDraft(busy || childDirty || deleteBusy, onDirtyChange)
	const [editing, setEditing] = useState<{
		scheme: CatalogScheme | null
		startingColors?: ColorScheme['colors']
	} | null>(null)
	useEffect(() => {
		let active = true
		void Promise.all([loadColorSchemes(client), loadSchemeSets(client)])
			.then(([next, nextSets]) => {
				if (active) {
					setSchemes(next)
					setSets(nextSets)
					setChecked(
						previous =>
							new Set(
								[...previous].filter(id =>
									next.some(scheme => scheme.id === id),
								),
							),
					)
					setFilter(previous =>
						previous === 'all' ||
						previous === 'ungrouped' ||
						nextSets.some(set => set.row.id === previous)
							? previous
							: 'all',
					)
					setTargetSet(previous =>
						nextSets.some(
							set =>
								set.row.id === previous &&
								!set.row.published_at &&
								!set.row.release_at,
						)
							? previous
							: '',
					)
				}
			})
			.catch((cause: unknown) => {
				if (active) setError(errorMessage(cause))
			})
			.finally(() => {
				if (active) setLoading(false)
			})
		return () => {
			active = false
		}
	}, [client, reload])
	function refresh(preserveSelection = false) {
		setLoading(true)
		setError('')
		if (!preserveSelection) setChecked(new Set())
		setReload(value => value + 1)
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
				refresh()
			})
		} catch (cause) {
			setActionError(errorMessage(cause))
		} finally {
			working.current = false
			setBusy(false)
		}
	}
	if (showSets)
		return (
			<SchemeSetLibrary
				client={client}
				sets={sets}
				loading={loading}
				refreshing={reload > 0}
				catalogError={error}
				onBack={() => {
					setShowSets(false)
					refresh()
				}}
				onChanged={refresh}
				onDirtyChange={setChildDirty}
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
				onDirtyChange={setChildDirty}
				onBack={() => setEditing(null)}
				onSaved={message => {
					setStatus(message)
					setEditing(null)
					refresh()
				}}
			/>
		)
	}
	return (
		<section aria-labelledby="scheme-library-title">
			<Button
				variant="link"
				type="button"
				className={adminStyles.backLink}
				onClick={onBack}
				disabled={busy}
			>
				<FontAwesomeIcon icon={faSquareArrowLeft} aria-hidden="true" />{' '}
				Back to puzzles
			</Button>
			<div className={adminStyles.galleryHeading}>
				<h2 id="scheme-library-title">Palettes</h2>
				<div className={adminStyles.galleryControls}>
					<AdminIconButton
						icon={faLayerGroup}
						label="Manage palette sets"
						disabled={busy || loading || !!error}
						onClick={() => {
							setShowSets(true)
							setStatus('')
						}}
					/>
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
				</div>
			</div>
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
			{status && <p role="status">{status}</p>}
			{deleting && (
				<PaletteDeleteDialog
					{...deleteModal}
					client={client}
					scheme={deleting}
					onDirtyChange={setDeleteBusy}
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
						reload > 0
							? 'Refreshing palettes…'
							: 'Loading palettes…'
					}
				/>
			)}
			{error && <p role="alert">{error}</p>}
			{!loading &&
				!error &&
				(schemes.length ? (
					<ul className={styles.cards}>
						{schemes
							.filter(scheme => {
								const set = sets.find(set =>
									set.members.some(
										member => member.id === scheme.id,
									),
								)
								return (
									filter === 'all' ||
									(filter === 'ungrouped'
										? !set
										: set?.row.id === filter)
								)
							})
							.map(scheme => (
								<li
									className={styles.card}
									key={scheme.id}
									aria-label={`Palette ${scheme.name}`}
								>
									<Swatches colors={scheme.colors} />
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
															member.id ===
															scheme.id,
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
												member =>
													member.id === scheme.id,
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
													startingColors:
														scheme.colors,
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
					</ul>
				) : (
					<p>No palettes yet. Create a draft to get started.</p>
				))}
		</section>
	)
}
