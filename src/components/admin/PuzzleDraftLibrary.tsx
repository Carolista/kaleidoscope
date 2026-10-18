import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import {
	renderAuthoredHexPuzzle,
	type AuthoringPalette,
} from '../../puzzles/hexAuthoring'
import {
	deletePuzzleDraft,
	editPuzzleDraft,
	loadPuzzleDrafts,
	type LibraryDraft,
} from '../../services/puzzleLibrary'
import type { PuzzleUsage } from '../../services/puzzleDrafts'
import HexPuzzleBoard from '../puzzle/HexPuzzleBoard'
import PuzzleMode from '../puzzle/PuzzleMode'
import paletteStyles from '../controls/color-schemes/SchemePicker.module.css'
import styles from './AdminPortal.module.css'
import useUnsavedDraft, { confirmDiscardDraft } from './useUnsavedDraft'

function message(cause: unknown) {
	return cause instanceof Error
		? cause.message
		: 'Unable to manage puzzle drafts.'
}

function DraftEditor({
	client,
	draft,
	palettes,
	onChanged,
	onBack,
	onDirtyChange,
}: {
	readonly client: SupabaseClient<Database>
	readonly draft: LibraryDraft
	readonly palettes: readonly AuthoringPalette[]
	readonly onChanged: (status: string, updated: LibraryDraft | null) => void
	readonly onBack: () => void
	readonly onDirtyChange?: (dirty: boolean) => void
}) {
	const [name, setName] = useState(draft.row.name)
	const [paletteId, setPaletteId] = useState(draft.row.palette_id)
	const [usage, setUsage] = useState<PuzzleUsage>(
		draft.row.usage === 'daily' ? 'daily' : 'collection',
	)
	const [busy, setBusy] = useState(false)
	const working = useRef(false)
	const [error, setError] = useState('')
	const [confirmDelete, setConfirmDelete] = useState(false)
	const palette = palettes.find(value => value.id === paletteId)
	const dirty =
		name !== draft.row.name ||
		paletteId !== draft.row.palette_id ||
		usage !== draft.row.usage
	useUnsavedDraft(dirty || busy, onDirtyChange)

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (working.current) return
		setError('')
		if (!name.trim()) {
			setError('Enter a name for the puzzle draft.')
			return
		}
		working.current = true
		setBusy(true)
		try {
			await editPuzzleDraft(client, draft.row.id, name, paletteId, usage)
			setName(name.trim())
			onChanged('Draft changes saved.', {
				...draft,
				row: {
					...draft.row,
					name: name.trim(),
					palette_id: paletteId,
					usage,
				},
				puzzle: { ...draft.puzzle, paletteId },
			})
		} catch (cause) {
			setError(message(cause))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	async function remove() {
		if (working.current) return
		working.current = true
		setBusy(true)
		setError('')
		try {
			await deletePuzzleDraft(client, draft.row.id)
			onChanged(`Deleted "${draft.row.name}".`, null)
		} catch (cause) {
			setError(message(cause))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	return (
		<article aria-label={`Edit ${draft.row.name}`}>
			<button
				type="button"
				disabled={busy}
				onClick={() => {
					if (!dirty || confirmDiscardDraft()) onBack()
				}}
			>
				Back to library
			</button>
			<h2>Editing: {draft.row.name}</h2>
			<p>
				{draft.puzzle.recipe.label} ·{' '}
				{draft.assigned ? 'Assigned' : 'Unassigned'}
			</p>
			{error && <p role="alert">{error}</p>}
			<form onSubmit={save} className={styles.form}>
				<div className={styles.metadataForm}>
					<div className={styles.metadataField}>
						<label htmlFor="library-name">Puzzle name</label>
						<input
							id="library-name"
							required
							value={name}
							disabled={busy}
							onChange={event => setName(event.target.value)}
						/>
					</div>
					<div className={styles.metadataField}>
						<label htmlFor="library-usage">Intended use</label>
						<select
							id="library-usage"
							value={usage}
							disabled={busy || draft.assigned}
							onChange={event => {
								const value = event.target.value
								if (value === 'daily' || value === 'collection')
									setUsage(value)
							}}
						>
							<option value="collection">Set/pack</option>
							<option value="daily">Daily</option>
						</select>
					</div>
					<button type="submit" disabled={busy || !palette}>
						Save changes
					</button>
				</div>
				{draft.assigned && (
					<p>
						Unassign this puzzle before changing its intended use or
						deleting it.
					</p>
				)}
				<fieldset className={styles.palettePicker} disabled={busy}>
					<legend>Draft palette</legend>
					<ul className={paletteStyles.list}>
						{palettes.map(value => (
							<li key={value.id}>
								<button
									type="button"
									className={styles.paletteOption}
									aria-pressed={value.id === paletteId}
									aria-label={`Use ${value.name} for this draft`}
									onClick={() => setPaletteId(value.id)}
								>
									<span
										className={styles.paletteColors}
										aria-hidden="true"
									>
										{value.colors.map((color, index) => (
											<span
												key={index}
												className={paletteStyles.swatch}
												style={{
													backgroundColor: color,
												}}
											/>
										))}
									</span>
									<span>{value.name}</span>
								</button>
							</li>
						))}
					</ul>
				</fieldset>
			</form>
			{palette ? (
				<div className={styles.playtest}>
					{draft.puzzle.recipe.rotation && (
						<p className={styles.rotationHelp}>
							Tap tray pieces to rotate; drag to place. Double-tap
							board pieces to return. Keyboard: Enter/Space
							rotates, activate a tile to place, Delete/Backspace
							returns.
						</p>
					)}
					<PuzzleMode
						previewPuzzle={renderAuthoredHexPuzzle(
							{ ...draft.puzzle, paletteId },
							palette,
						)}
					/>
				</div>
			) : (
				<p role="alert">
					This draft's palette is unavailable. Choose another palette
					or refresh palettes.
				</p>
			)}
			{confirmDelete ? (
				<div role="group" aria-label="Confirm draft deletion">
					<p>
						Delete "{draft.row.name}" permanently? Its saved design
						and private solution will be removed.
					</p>
					<button
						type="button"
						disabled={busy}
						onClick={() => {
							void remove()
						}}
					>
						Confirm delete
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={() => setConfirmDelete(false)}
					>
						Keep draft
					</button>
				</div>
			) : (
				<button
					type="button"
					disabled={busy || draft.assigned}
					onClick={() => setConfirmDelete(true)}
				>
					Delete draft
				</button>
			)}
		</article>
	)
}

export default function PuzzleDraftLibrary({
	client,
	palettes,
	revision,
	onNew,
	onDirtyChange,
}: {
	readonly client: SupabaseClient<Database>
	readonly palettes: readonly AuthoringPalette[]
	readonly revision: number
	readonly onNew?: () => void
	readonly onDirtyChange?: (dirty: boolean) => void
}) {
	const [drafts, setDrafts] = useState<readonly LibraryDraft[]>([])
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [reload, setReload] = useState(0)
	const [filter, setFilter] = useState('all')
	const [status, setStatus] = useState('')
	useEffect(() => {
		let active = true
		async function load() {
			setLoading(true)
			setError('')
			try {
				const next = await loadPuzzleDrafts(client)
				if (active) {
					setDrafts(next)
					setSelectedId(previous =>
						next.some(draft => draft.row.id === previous)
							? previous
							: null,
					)
				}
			} catch (cause) {
				if (active) setError(message(cause))
			} finally {
				if (active) setLoading(false)
			}
		}
		void load()
		return () => {
			active = false
		}
	}, [client, revision, reload])
	const selected = drafts.find(value => value.row.id === selectedId)
	const visible = drafts.filter(
		value => filter === 'all' || value.row.usage === filter,
	)
	if (selected) {
		return (
			<>
				{status && <p role="status">{status}</p>}
				<DraftEditor
					key={selected.row.id}
					client={client}
					draft={selected}
					palettes={palettes}
					onBack={() => {
						setSelectedId(null)
						setReload(value => value + 1)
						setStatus('')
					}}
					onDirtyChange={onDirtyChange}
					onChanged={(status, updated) => {
						setStatus(status)
						setDrafts(previous =>
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
						if (!updated) {
							setSelectedId(null)
							setReload(value => value + 1)
						}
					}}
				/>
			</>
		)
	}
	return (
		<section aria-labelledby="draft-library-title">
			<h2 id="draft-library-title">Puzzle drafts</h2>
			{onNew && (
				<button type="button" onClick={onNew}>
					New puzzle
				</button>
			)}
			<button
				type="button"
				disabled={loading}
				onClick={() => setReload(value => value + 1)}
			>
				Refresh drafts
			</button>
			<label htmlFor="draft-filter">Show drafts</label>{' '}
			<select
				id="draft-filter"
				value={filter}
				onChange={event => {
					setFilter(event.target.value)
					setSelectedId(null)
				}}
			>
				<option value="all">All uses</option>
				<option value="collection">Set/pack</option>
				<option value="daily">Daily</option>
			</select>
			{error && <p role="alert">{error}</p>}
			{status && <p role="status">{status}</p>}
			{loading ? (
				<p role="status">Loading puzzle drafts...</p>
			) : error ? null : (
				<>
					{!visible.length && <p>No drafts match this view.</p>}
					<ul className={styles.draftList}>
						{visible.map(draft => {
							const palette = palettes.find(
								value => value.id === draft.puzzle.paletteId,
							)
							const preview = palette
								? renderAuthoredHexPuzzle(draft.puzzle, palette)
								: null
							return (
								<li key={draft.row.id}>
									<button
										type="button"
										aria-pressed={
											selectedId === draft.row.id
										}
										aria-label={`Open draft ${draft.row.name}`}
										onClick={() => {
											setStatus('')
											setSelectedId(draft.row.id)
										}}
									>
										{preview ? (
											<span
												aria-hidden="true"
												className={styles.thumbnail}
											>
												<HexPuzzleBoard
													target
													radius={preview.radius}
													colors={preview.target}
												/>
											</span>
										) : (
											<span>Palette unavailable</span>
										)}
										<strong>{draft.row.name}</strong>
										<span>{draft.puzzle.recipe.label}</span>
										<span>
											{draft.row.usage === 'daily'
												? 'Daily'
												: 'Set/pack'}{' '}
											·{' '}
											{draft.assigned
												? 'Assigned'
												: 'Unassigned'}
										</span>
									</button>
								</li>
							)
						})}
					</ul>
				</>
			)}
		</section>
	)
}
