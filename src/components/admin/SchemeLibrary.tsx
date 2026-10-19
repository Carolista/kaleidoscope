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
import HexPuzzleBoard from '../puzzle/HexPuzzleBoard'
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

function UsageDetails({
	usage,
	colors,
}: {
	readonly usage: SchemeUsage
	readonly colors: ColorScheme['colors'] | null
}) {
	return (
		<>
			<p>
				{usage.starters
					? 'Included in starter offerings.'
					: 'Not a starter palette.'}
			</p>
			{!schemeIsUsed(usage) && (
				<p>No saved references blocking deletion.</p>
			)}
			{schemeIsUsed(usage) && (
				<p>This palette is in use and cannot be deleted.</p>
			)}
			{usage.packs.length > 0 && (
				<>
					<h4>Palette sets</h4>
					<ul>
						{usage.packs.map((name, index) => (
							<li key={index}>{name}</li>
						))}
					</ul>
				</>
			)}
			{usage.rewards.length > 0 && (
				<>
					<h4>Puzzle rewards</h4>
					<ul>
						{usage.rewards.map((name, index) => (
							<li key={index}>{name}</li>
						))}
					</ul>
				</>
			)}
			{usage.grants > 0 && <p>Ownership grants: {usage.grants}</p>}
			{usage.corrections > 0 && (
				<p>Correction history records: {usage.corrections}</p>
			)}
			{usage.puzzles.length > 0 && (
				<>
					<h4>Linked puzzles ({usage.puzzles.length})</h4>
					<ul className={styles.linkedPuzzles}>
						{usage.puzzles.map(puzzle => (
							<li key={puzzle.id}>
								{puzzle.preview && colors && (
									<div className={styles.thumbnail}>
										<HexPuzzleBoard
											target
											label={`${puzzle.name} palette preview`}
											radius={puzzle.preview.radius}
											colors={Object.fromEntries(
												Object.entries(
													puzzle.preview.target,
												).map(([group, slot]) => [
													group,
													colors[slot],
												]),
											)}
										/>
									</div>
								)}
								<span>
									<strong>{puzzle.name}</strong>
									<br />
									{puzzle.context}
								</span>
							</li>
						))}
					</ul>
				</>
			)}
		</>
	)
}

function SchemeEditor({
	client,
	initial,
	startingColors,
	deleting,
	onBack,
	onSaved,
	onDirtyChange,
}: {
	readonly client: SupabaseClient<Database>
	readonly initial: CatalogScheme | null
	readonly startingColors: readonly string[]
	readonly deleting: boolean
	readonly onBack: () => void
	readonly onSaved: (message: string) => void
	readonly onDirtyChange?: (dirty: boolean) => void
}) {
	const [name, setName] = useState(initial?.name ?? '')
	const [colors, setColors] = useState<readonly string[]>(startingColors)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const working = useRef(false)
	const createRequest = useRef<{ id: string; content: string } | null>(null)
	const [confirmDelete, setConfirmDelete] = useState(deleting)
	const [usage, setUsage] = useState<SchemeUsage | null>(null)
	const [usageError, setUsageError] = useState('')
	const [usageReload, setUsageReload] = useState(0)
	const [usageLoading, setUsageLoading] = useState(!!initial)
	const readOnly = !!initial?.published_at || !!initial?.release_at
	const dirty =
		!readOnly &&
		(name !== (initial?.name ?? '') ||
			colors.some((color, index) => color !== startingColors[index]))
	useUnsavedDraft(dirty || busy, onDirtyChange)
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
		setBusy(true)
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
			setBusy(false)
		}
	}
	async function remove() {
		if (working.current || !initial || !canDelete) return
		working.current = true
		setBusy(true)
		setError('')
		try {
			await manageColorScheme(client, {
				kind: 'delete',
				previous: initial,
			})
			onSaved(`Deleted "${initial.name}".`)
		} catch (cause) {
			setError(errorMessage(cause))
		} finally {
			working.current = false
			setBusy(false)
		}
	}
	return (
		<section aria-labelledby="scheme-editor-title">
			<button
				type="button"
				className={adminStyles.backLink}
				disabled={busy}
				onClick={back}
			>
				<FontAwesomeIcon icon={faSquareArrowLeft} aria-hidden="true" />{' '}
				Back to palettes
			</button>
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
			<div className={styles.editor}>
				<form
					onSubmit={save}
					className={adminStyles.form}
					aria-label={initial ? 'Edit palette' : 'Create palette'}
				>
					<div className={adminStyles.metadataField}>
						<label htmlFor="scheme-name">Palette name</label>
						<input
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
										<input
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
									<input
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
						<button
							type="submit"
							disabled={
								busy ||
								!validColors ||
								!name.trim() ||
								(!!initial && !dirty)
							}
						>
							{busy ? 'Saving…' : 'Save palette'}
						</button>
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
						<p role="status">Loading palette usage…</p>
					)}
					{usageError && (
						<p role="alert">
							{usageError} Deletion is disabled until usage can be
							checked.
						</p>
					)}
					{usage && !usageLoading && !usageError && (
						<UsageDetails usage={usage} colors={validColors} />
					)}
					{!readOnly && (
						<>
							<button
								type="button"
								className={styles.deleteButton}
								disabled={busy || !canDelete}
								onClick={() => setConfirmDelete(true)}
							>
								Delete palette
							</button>
							{confirmDelete && canDelete && (
								<div
									className={adminStyles.bulkPanel}
									role="group"
									aria-label="Confirm palette deletion"
								>
									<p>
										Delete "{initial.name}" permanently? Any
										draft set membership will be removed.
										{dirty
											? ' Unsaved edits will also be discarded.'
											: ''}
									</p>
									<button
										type="button"
										disabled={busy}
										onClick={() => {
											void remove()
										}}
									>
										Confirm delete palette
									</button>{' '}
									<button
										type="button"
										disabled={busy}
										onClick={() => setConfirmDelete(false)}
									>
										Cancel deletion
									</button>
								</div>
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
	const working = useRef(false)
	const [childDirty, setChildDirty] = useState(false)
	useUnsavedDraft(busy || childDirty, onDirtyChange)
	const [editing, setEditing] = useState<{
		scheme: CatalogScheme | null
		deleting: boolean
		startingColors?: ColorScheme['colors']
	} | null>(null)
	useEffect(() => {
		let active = true
		void Promise.all([loadColorSchemes(client), loadSchemeSets(client)])
			.then(([next, nextSets]) => {
				if (active) {
					setSchemes(next)
					setSets(nextSets)
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
	function refresh() {
		setLoading(true)
		setError('')
		setChecked(new Set())
		setReload(value => value + 1)
	}
	async function assign() {
		if (working.current || !targetSet || checked.size === 0) return
		working.current = true
		setBusy(true)
		setError('')
		try {
			await manageSchemeSet(client, targetSet, {
				kind: 'assign',
				paletteIds: [...checked],
			})
			setStatus(
				'Palettes assigned. Previous draft set memberships were replaced.',
			)
			refresh()
		} catch (cause) {
			setError(errorMessage(cause))
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
				deleting={editing.deleting}
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
			<button
				type="button"
				className={adminStyles.backLink}
				onClick={onBack}
				disabled={busy}
			>
				<FontAwesomeIcon icon={faSquareArrowLeft} aria-hidden="true" />{' '}
				Back to puzzles
			</button>
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
							setEditing({ scheme: null, deleting: false })
						}}
					/>
					<AdminIconButton
						icon={faRotate}
						label="Refresh palette catalog"
						disabled={busy || loading}
						onClick={refresh}
					/>
				</div>
			</div>
			<p>
				Organize palettes in sets without changing starter offerings,
				rewards, puzzle usage, or store access.
			</p>
			<div className={styles.organize}>
				<label htmlFor="scheme-set-filter">Show palettes</label>
				<select
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
				</select>
				<label htmlFor="scheme-assign-set">
					Assign selected to set
				</label>
				<select
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
				</select>
				<button
					type="button"
					disabled={
						loading || busy || !targetSet || checked.size === 0
					}
					onClick={() => {
						void assign()
					}}
				>
					Assign {checked.size} selected
				</button>
				{checked.size > 0 && (
					<button
						type="button"
						disabled={busy}
						onClick={() => setChecked(new Set())}
					>
						Clear selection
					</button>
				)}
			</div>
			{status && <p role="status">{status}</p>}
			{loading && <p role="status">Loading palettes…</p>}
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
													deleting: false,
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
													deleting: false,
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
												setEditing({
													scheme,
													deleting: true,
												})
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
