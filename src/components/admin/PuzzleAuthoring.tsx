import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
	generateAuthoredHexPuzzle,
	renderAuthoredHexPuzzle,
	type AuthoredHexPuzzle,
	type AuthoringPalette,
} from '../../puzzles/hexAuthoring'
import { HEX_PUZZLE_RECIPES } from '../../puzzles/hexPuzzle'
import { createUnusedPuzzleSeed } from '../../puzzles/puzzleSeed'
import type { Database } from '../../types/database'
import paletteStyles from '../controls/color-schemes/SchemePicker.module.css'
import PuzzleMode from '../puzzle/PuzzleMode'
import styles from './AdminPortal.module.css'

function messageFor(cause: unknown): string {
	return cause instanceof Error
		? cause.message
		: 'Unable to prepare the puzzle playtest.'
}

export default function PuzzleAuthoring({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const [palettes, setPalettes] = useState<readonly AuthoringPalette[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [reload, setReload] = useState(0)
	const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(
		null,
	)
	const previewedSeeds = useRef(new Map<string, Set<string>>())
	const [generated, setGenerated] = useState<{
		puzzle: AuthoredHexPuzzle
		run: number
	} | null>(null)

	useEffect(() => {
		let active = true
		async function load() {
			try {
				const { data, error } = await client
					.from('palettes')
					.select('id, name, colors')
					.order('name')
				if (error) throw new Error(error.message)
				if (!data)
					throw new Error('The palette catalog returned no data.')
				const next = data.map(row => {
					const [a, b, c, d, e] = row.colors
					if (
						row.colors.length !== 5 ||
						!a ||
						!b ||
						!c ||
						!d ||
						!e ||
						row.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color))
					) {
						throw new Error(
							`Palette "${row.name}" must contain five six-digit hex colors.`,
						)
					}
					return {
						id: row.id,
						name: row.name,
						colors: [a, b, c, d, e] as const,
					}
				})
				if (active) setPalettes(next)
			} catch (cause) {
				if (active) {
					setPalettes([])
					setError(messageFor(cause))
				}
			} finally {
				if (active) setLoading(false)
			}
		}
		void load()
		return () => {
			active = false
		}
	}, [client, reload])

	function generate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setError('')
		const form = new FormData(event.currentTarget)
		const recipe = HEX_PUZZLE_RECIPES.find(
			value => value.id === form.get('recipe'),
		)
		const palette =
			palettes.find(value => value.id === selectedPaletteId) ??
			palettes[0]
		try {
			if (!recipe || !palette)
				throw new Error(
					'Choose a recipe and palette before generating.',
				)
			const recipeKey = `hexagon:${recipe.id}`
			const excluded =
				previewedSeeds.current.get(recipeKey) ?? new Set<string>()
			const seed = createUnusedPuzzleSeed(excluded)
			const puzzle = generateAuthoredHexPuzzle(seed, palette.id, recipe)
			excluded.add(seed)
			previewedSeeds.current.set(recipeKey, excluded)
			setGenerated(previous => ({
				puzzle,
				run: (previous?.run ?? 0) + 1,
			}))
		} catch (cause) {
			setError(messageFor(cause))
		}
	}

	const palette = palettes.find(
		value => value.id === generated?.puzzle.paletteId,
	)
	const selectedPalette =
		palettes.find(value => value.id === selectedPaletteId) ?? palettes[0]
	return (
		<section aria-labelledby="puzzle-authoring-title">
			<h2 id="puzzle-authoring-title">Hexagon puzzle lab</h2>
			<p>
				Generate and playtest all six recipes. This lab is temporary:
				puzzles are not saved or published.
			</p>
			{error && <p role="alert">{error}</p>}
			<button
				type="button"
				disabled={loading}
				onClick={() => {
					setLoading(true)
					setError('')
					setReload(value => value + 1)
				}}
			>
				Refresh palettes
			</button>
			{loading ? (
				<p role="status">Loading Supabase palettes...</p>
			) : palettes.length === 0 ? (
				<p>
					No palettes available. Add a palette to the catalog before
					generating.
				</p>
			) : (
				<form onSubmit={generate} className={styles.form}>
					<fieldset className={styles.palettePicker}>
						<legend>Palette</legend>
						<ul className={paletteStyles.list}>
							{palettes.map(palette => (
								<li key={palette.id}>
									<button
										type="button"
										className={styles.paletteOption}
										aria-label={`Select the ${palette.name} color palette`}
										aria-pressed={
											selectedPalette?.id === palette.id
										}
										onClick={() => {
											setSelectedPaletteId(palette.id)
											setGenerated(previous =>
												previous
													? {
															...previous,
															puzzle: {
																...previous.puzzle,
																paletteId:
																	palette.id,
															},
														}
													: null,
											)
										}}
									>
										<span
											className={styles.paletteColors}
											aria-hidden="true"
										>
											{palette.colors.map(
												(color, index) => (
													<span
														key={index}
														className={
															paletteStyles.swatch
														}
														style={{
															backgroundColor:
																color,
														}}
													/>
												),
											)}
										</span>
										<span>{palette.name}</span>
									</button>
								</li>
							))}
						</ul>
					</fieldset>
					<label htmlFor="puzzle-recipe">Recipe</label>
					<select id="puzzle-recipe" name="recipe">
						{HEX_PUZZLE_RECIPES.map(recipe => (
							<option key={recipe.id} value={recipe.id}>
								{recipe.label}
							</option>
						))}
					</select>
					<p>
						Randomize to browse another puzzle. Seeds already
						previewed for this recipe are skipped until you leave
						the lab.
					</p>
					<button type="submit">Randomize puzzle</button>
				</form>
			)}
			{generated && palette && (
				<div className={styles.playtest}>
					<h3>{generated.puzzle.recipe.label}</h3>
					<p>
						Palette: {palette.name}. Seed: {generated.puzzle.seed}
					</p>
					{generated.puzzle.recipe.rotation && (
						<p>
							Click or tap a tray piece to rotate it 60 degrees;
							drag to move it. Double-click or double-tap a board
							piece to return it to the tray. Keyboard:
							Enter/Space rotates a tray piece, then activate a
							board tile to place; Delete/Backspace returns a
							board piece.
						</p>
					)}
					<PuzzleMode
						key={generated.run}
						previewPuzzle={renderAuthoredHexPuzzle(
							generated.puzzle,
							palette,
						)}
					/>
				</div>
			)}
			{generated && !palette && !loading && (
				<p role="alert">
					The playtest palette is unavailable. Refresh palettes or
					generate a new playtest.
				</p>
			)}
		</section>
	)
}
