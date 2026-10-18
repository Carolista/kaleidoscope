import { faRotate, faWandMagicSparkles } from '@fortawesome/pro-solid-svg-icons'
import { useId, type SubmitEvent } from 'react'
import type { AuthoringPalette } from '../../puzzles/hexAuthoring'
import { HEX_PUZZLE_RECIPES } from '../../puzzles/hexPuzzle'
import type { PuzzleUsage } from '../../services/puzzleDrafts'
import paletteStyles from '../controls/color-schemes/SchemePicker.module.css'
import AdminIconButton from './AdminIconButton'
import styles from './AdminPortal.module.css'

interface DraftMetadata {
	readonly name: string
	readonly usage: PuzzleUsage
	readonly onNameChange: (name: string) => void
	readonly onUsageChange: (usage: PuzzleUsage) => void
	readonly locked?: boolean
	readonly assigned?: boolean
	readonly submitDisabled?: boolean
	readonly recipeLabel?: string
}

interface DraftGeneration {
	readonly recipeId: string
	readonly onRecipeChange: (recipeId: string) => void
	readonly onGenerate: () => void
}

export default function PuzzleDraftForm({
	mode,
	palettes,
	paletteId,
	onPaletteChange,
	onRefreshPalettes,
	palettesLoading = false,
	busy,
	metadata,
	generation,
	onSubmit,
}: {
	readonly mode: 'create' | 'edit'
	readonly palettes: readonly AuthoringPalette[]
	readonly paletteId?: string
	readonly onPaletteChange: (id: string) => void
	readonly onRefreshPalettes?: () => void
	readonly palettesLoading?: boolean
	readonly busy: boolean
	readonly metadata: DraftMetadata
	readonly generation?: DraftGeneration
	readonly onSubmit: (event: SubmitEvent<HTMLFormElement>) => void
}) {
	const id = useId()
	return (
		<form
			onSubmit={onSubmit}
			className={styles.form}
			aria-label={
				mode === 'create' ? 'Save puzzle draft' : 'Edit puzzle draft'
			}
		>
			<div className={styles.authoringForm}>
				<div className={styles.paletteControls}>
					<fieldset
						className={styles.palettePicker}
						aria-label="Palette"
						disabled={busy || palettesLoading}
					>
						<legend className={styles.paletteHeading}>
							Palette
							{onRefreshPalettes && (
								<AdminIconButton
									icon={faRotate}
									label="Refresh palettes"
									disabled={busy || palettesLoading}
									onClick={onRefreshPalettes}
								/>
							)}
						</legend>
						{palettesLoading ? (
							<p role="status">Loading Supabase palettes...</p>
						) : palettes.length === 0 ? (
							<p>
								No palettes available. Add a palette to the
								catalog before generating.
							</p>
						) : (
							<ul className={paletteStyles.list}>
								{palettes.map(palette => (
									<li key={palette.id}>
										<button
											type="button"
											className={styles.paletteOption}
											aria-label={`Select the ${palette.name} color palette`}
											aria-pressed={
												paletteId === palette.id
											}
											onClick={() =>
												onPaletteChange(palette.id)
											}
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
						)}
					</fieldset>
				</div>
				<div className={styles.draftControls}>
					<div className={styles.metadataField}>
						<label htmlFor={`${id}-name`}>Puzzle name</label>
						<input
							id={`${id}-name`}
							value={metadata.name}
							required
							disabled={busy}
							onChange={event =>
								metadata.onNameChange(event.target.value)
							}
						/>
					</div>
					{generation ? (
						<div className={styles.recipeControls}>
							<div className={styles.metadataField}>
								<label htmlFor={`${id}-recipe`}>Recipe</label>
								<select
									id={`${id}-recipe`}
									value={generation.recipeId}
									disabled={
										busy ||
										palettesLoading ||
										palettes.length === 0
									}
									onChange={event =>
										generation.onRecipeChange(
											event.target.value,
										)
									}
								>
									{HEX_PUZZLE_RECIPES.map(recipe => (
										<option
											key={recipe.id}
											value={recipe.id}
										>
											{recipe.label}
										</option>
									))}
								</select>
							</div>
							<AdminIconButton
								icon={faWandMagicSparkles}
								label="Randomize puzzle"
								disabled={
									busy ||
									palettesLoading ||
									palettes.length === 0
								}
								onClick={generation.onGenerate}
							/>
						</div>
					) : (
						<div className={styles.metadataField}>
							<label htmlFor={`${id}-recipe`}>Recipe</label>
							<input
								id={`${id}-recipe`}
								value={metadata.recipeLabel ?? ''}
								readOnly
							/>
						</div>
					)}
					<div className={styles.metadataForm}>
						<div className={styles.metadataField}>
							<label htmlFor={`${id}-usage`}>Intended use</label>
							<select
								id={`${id}-usage`}
								value={metadata.usage}
								disabled={
									busy || metadata.locked || metadata.assigned
								}
								onChange={event => {
									const value = event.target.value
									if (
										value === 'collection' ||
										value === 'daily'
									)
										metadata.onUsageChange(value)
								}}
							>
								<option value="collection">Set/pack</option>
								<option value="daily">Daily</option>
							</select>
						</div>
						<button
							className={styles.saveButton}
							type="submit"
							disabled={
								busy ||
								metadata.locked ||
								metadata.submitDisabled ||
								!metadata.name.trim()
							}
						>
							{mode === 'create' ? 'Save Draft' : 'Save Changes'}
						</button>
					</div>
					{metadata.assigned && (
						<p>
							Unassign this puzzle before changing its intended
							use or deleting it.
						</p>
					)}
				</div>
			</div>
		</form>
	)
}
