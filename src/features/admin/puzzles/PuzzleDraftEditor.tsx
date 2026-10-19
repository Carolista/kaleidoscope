import { useRef, useState, type SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import {
	renderAuthoredPuzzle,
	type AuthoredPuzzle,
	type AuthoringPalette,
	PUZZLE_RECIPES,
} from '@/domain/puzzles'
import {
	deletePuzzleDraft,
	editPuzzleDraft,
	replacePuzzleDraft,
	type LibraryDraft,
	generateDraftPreview,
	previewedSeedKey,
	puzzleDraftArgs,
	type PuzzleUsage,
} from '@/features/admin/services'
import PuzzlePlaytest from './PuzzlePlaytest'
import { AdminFeedback, errorMessage } from '@/features/admin/common'
import { Button, ConfirmDialog, Loading } from '@/ui/components'
import PuzzleDraftForm from './PuzzleDraftForm'
import { useUnsavedDraft } from '@/ui/navigation'
import { useModalState } from '@/ui/hooks'

const fallbackError = 'Unable to manage puzzle drafts.'

export default function PuzzleDraftEditor({
	client,
	draft,
	palettes,
	onChanged,
	onRefreshPalettes,
	palettesLoading,
	palettesRefreshing,
	palettesError,
}: {
	readonly client: SupabaseClient<Database>
	readonly draft: LibraryDraft
	readonly palettes: readonly AuthoringPalette[]
	readonly onChanged: (status: string, updated: LibraryDraft | null) => void
	readonly onRefreshPalettes?: () => void
	readonly palettesLoading?: boolean
	readonly palettesRefreshing?: boolean
	readonly palettesError?: boolean
}) {
	const [name, setName] = useState(draft.row.name)
	const [paletteId, setPaletteId] = useState(draft.row.palette_id)
	const [usage, setUsage] = useState<PuzzleUsage>(
		draft.row.usage === 'daily' ? 'daily' : 'collection',
	)
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const working = useRef(false)
	const [error, setError] = useState('')
	const [confirmDelete, setConfirmDelete, editorDeleteModal] =
		useModalState<true>()
	const [deleteError, setDeleteError] = useState('')
	const [recipeId, setRecipeId] = useState<string>(draft.puzzle.recipe.id)
	const [replacement, setReplacement] = useState<AuthoredPuzzle | null>(null)
	const [previewRun, setPreviewRun] = useState(0)
	const previewedSeeds = useRef(
		new Map([
			[
				previewedSeedKey(draft.puzzle.shape, draft.puzzle.recipe),
				new Set([draft.puzzle.seed]),
			],
		]),
	)
	const puzzle = replacement ?? draft.puzzle
	const palette = palettes.find(value => value.id === paletteId)
	const dirty =
		name !== draft.row.name ||
		paletteId !== draft.row.palette_id ||
		usage !== draft.row.usage ||
		replacement !== null
	useUnsavedDraft({ dirty, pending: busy })

	async function generate() {
		if (working.current) return
		setError('')
		working.current = true
		setPending('Generating puzzle preview…')
		try {
			const recipe = PUZZLE_RECIPES.find(value => value.id === recipeId)
			if (!recipe || !palette)
				throw new Error(
					'Choose a recipe and palette before generating.',
				)
			const next = await generateDraftPreview(
				client,
				recipe,
				paletteId,
				previewedSeeds.current,
				draft.puzzle.shape,
			)
			setReplacement(next)
			setPreviewRun(value => value + 1)
		} catch (cause) {
			setError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setPending(null)
		}
	}

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (working.current) return
		setError('')
		if (!name.trim()) {
			setError('Enter a name for the puzzle draft.')
			return
		}
		working.current = true
		setPending('Saving puzzle draft…')
		try {
			const updatedPuzzle = { ...puzzle, paletteId }
			if (replacement) {
				await replacePuzzleDraft(
					client,
					draft.row.id,
					name,
					usage,
					updatedPuzzle,
				)
			} else {
				await editPuzzleDraft(
					client,
					draft.row.id,
					name,
					paletteId,
					usage,
				)
			}
			const args = puzzleDraftArgs(
				draft.row.id,
				name,
				usage,
				updatedPuzzle,
			)
			setName(name.trim())
			onChanged('Draft changes saved.', {
				...draft,
				row: {
					...draft.row,
					name: name.trim(),
					palette_id: paletteId,
					usage,
					board_size: args.p_board_size,
					rotation_allowed: args.p_rotation_allowed,
					difficulty: args.p_difficulty,
					definition: args.p_definition,
				},
				puzzle: updatedPuzzle,
			})
		} catch (cause) {
			setError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setPending(null)
		}
	}

	async function remove() {
		if (working.current) return
		working.current = true
		setPending('Deleting puzzle draft…')
		setDeleteError('')
		try {
			await deletePuzzleDraft(client, draft.row.id)
			setConfirmDelete(null, () =>
				onChanged(`Deleted "${draft.row.name}".`, null),
			)
		} catch (cause) {
			setDeleteError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setPending(null)
		}
	}

	return (
		<article aria-label={`Edit ${draft.row.name}`}>
			<h2>Editing: {draft.row.name}</h2>
			<AdminFeedback error={error} />
			<PuzzleDraftForm
				mode="edit"
				palettes={palettes}
				paletteId={paletteId}
				onPaletteChange={setPaletteId}
				onRefreshPalettes={onRefreshPalettes}
				palettesLoading={palettesLoading}
				palettesRefreshing={palettesRefreshing}
				palettesError={palettesError}
				busy={busy}
				generation={{
					shape: draft.puzzle.shape,
					recipeId,
					onRecipeChange: setRecipeId,
					onGenerate: () => {
						void generate()
					},
				}}
				metadata={{
					name,
					usage,
					onNameChange: setName,
					onUsageChange: setUsage,
					assigned: draft.assigned,
					submitDisabled: !palette || palettesLoading,
				}}
				onSubmit={save}
			/>
			{palette ? (
				<PuzzlePlaytest
					key={previewRun}
					puzzle={renderAuthoredPuzzle(
						{ ...puzzle, paletteId },
						palette,
					)}
				/>
			) : !palettesLoading && !palettesError ? (
				<p role="alert">
					This draft's palette is unavailable. Choose another palette
					or refresh palettes.
				</p>
			) : null}
			{confirmDelete && (
				<ConfirmDialog
					{...editorDeleteModal}
					title="Confirm draft deletion"
					closeLabel="Close draft deletion"
					destructive
					message={`Delete "${draft.row.name}" permanently? Its saved design and private solution will be removed.${dirty ? ' Unsaved edits will also be discarded.' : ''}`}
					confirmLabel="Confirm delete"
					cancelLabel="Keep draft"
					confirmDisabled={draft.assigned}
					pending={pending}
					error={deleteError}
					onConfirm={() => {
						void remove()
					}}
					onCancel={() => setConfirmDelete(null)}
				/>
			)}
			<Button
				type="button"
				disabled={busy || draft.assigned}
				onClick={() => {
					setDeleteError('')
					setConfirmDelete(true)
				}}
			>
				Delete draft
			</Button>
			{pending && !confirmDelete && <Loading label={pending} />}
		</article>
	)
}
