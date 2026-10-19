import { faRotate, faWandMagicSparkles } from '@fortawesome/pro-solid-svg-icons'
import type { SubmitEvent } from 'react'
import type { AuthoringPalette } from '../../puzzles/hexAuthoring'
import { HEX_PUZZLE_RECIPES } from '../../puzzles/hexPuzzle'
import type { PuzzleUsage } from '../../services/puzzleDrafts'
import AdminIconButton from './AdminIconButton'
import {
	Button,
	FormField,
	Input,
	Loading,
	PaletteChoices,
	Select,
} from '@shared'
import styles from './AdminPortal.module.css'

interface DraftMetadata {
	readonly name: string
	readonly usage: PuzzleUsage
	readonly onNameChange: (name: string) => void
	readonly onUsageChange: (usage: PuzzleUsage) => void
	readonly locked?: boolean
	readonly assigned?: boolean
	readonly submitDisabled?: boolean
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
	palettesRefreshing = false,
	palettesError = false,
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
	readonly palettesRefreshing?: boolean
	readonly palettesError?: boolean
	readonly busy: boolean
	readonly metadata: DraftMetadata
	readonly generation: DraftGeneration
	readonly onSubmit: (event: SubmitEvent<HTMLFormElement>) => void
}) {
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
						disabled={busy || palettesLoading || !!palettesError}
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
							<Loading
								label={
									palettesRefreshing
										? 'Refreshing palettes…'
										: 'Loading Supabase palettes...'
								}
							/>
						) : palettesError ? (
							<p>
								Refresh palettes to try loading the catalog
								again.
							</p>
						) : palettes.length === 0 ? (
							<p>
								No palettes available. Add a palette to the
								catalog before generating.
							</p>
						) : (
							<PaletteChoices
								palettes={palettes}
								selectedId={paletteId}
								onSelect={onPaletteChange}
								showNames
								disabled={
									busy || palettesLoading || palettesError
								}
							/>
						)}
					</fieldset>
				</div>
				<div className={styles.draftControls}>
					<FormField label="Puzzle name">
						{field => (
							<Input
								{...field}
								value={metadata.name}
								required
								disabled={busy}
								onChange={event =>
									metadata.onNameChange(event.target.value)
								}
							/>
						)}
					</FormField>
					<div className={styles.recipeControls}>
						<FormField label="Recipe">
							{field => (
								<Select
									{...field}
									value={generation.recipeId}
									disabled={
										busy ||
										palettesLoading ||
										palettesError ||
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
								</Select>
							)}
						</FormField>
						<AdminIconButton
							icon={faWandMagicSparkles}
							label="Randomize puzzle"
							disabled={
								busy ||
								palettesLoading ||
								palettesError ||
								palettes.length === 0
							}
							onClick={generation.onGenerate}
						/>
					</div>
					<div className={styles.metadataForm}>
						<FormField label="Intended use">
							{field => (
								<Select
									{...field}
									value={metadata.usage}
									disabled={
										busy ||
										metadata.locked ||
										metadata.assigned
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
								</Select>
							)}
						</FormField>
						<Button
							variant="primary"
							type="submit"
							disabled={
								busy ||
								palettesLoading ||
								palettesError ||
								metadata.locked ||
								metadata.submitDisabled ||
								!metadata.name.trim()
							}
						>
							{mode === 'create' ? 'Save Draft' : 'Save Changes'}
						</Button>
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
