import { faRotate, faWandMagicSparkles } from '@fortawesome/pro-solid-svg-icons'
import type { SubmitEvent } from 'react'
import type { AuthoringPalette, PuzzleShapeId } from '@/domain/puzzles'
import {
	isPuzzleShapeId,
	PUZZLE_RECIPES,
	PUZZLE_SHAPE_IDS,
	PUZZLE_SHAPE_LABELS,
} from '@/domain/puzzles'
import type { PuzzleUsage } from '@/features/admin/services'
import { AdminIconButton, AdminForm } from '@/features/admin/common'
import {
	Button,
	FormField,
	Input,
	Loading,
	PaletteChoices,
	Select,
} from '@/ui/components'
import { useNavigationGuard } from '@/ui/navigation'
import PaletteFieldset from './PaletteFieldset'
import styles from './PuzzleDraftForm.module.css'

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
	// Without a change handler the shape is shown but fixed.
	readonly shape: PuzzleShapeId
	readonly onShapeChange?: (shape: PuzzleShapeId) => void
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
	onCancel,
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
	// Returns to the list, after the discard prompt when work is unsaved.
	readonly onCancel: () => void
}) {
	const { requestNavigation } = useNavigationGuard()
	return (
		<AdminForm
			onSubmit={onSubmit}
			aria-label={
				mode === 'create' ? 'Save puzzle draft' : 'Edit puzzle draft'
			}
		>
			<div className={styles.authoringForm}>
				<div className={styles.paletteControls}>
					<PaletteFieldset
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
					</PaletteFieldset>
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
					<FormField label="Shape">
						{field => (
							<Select
								{...field}
								value={generation.shape}
								disabled={busy || !generation.onShapeChange}
								onChange={event => {
									const value = event.target.value
									if (isPuzzleShapeId(value))
										generation.onShapeChange?.(value)
								}}
							>
								{PUZZLE_SHAPE_IDS.map(shape => (
									<option key={shape} value={shape}>
										{PUZZLE_SHAPE_LABELS[shape]}
									</option>
								))}
							</Select>
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
									{PUZZLE_RECIPES.map(recipe => (
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
						<div className={styles.actions}>
							<Button
								disabled={busy}
								onClick={() => requestNavigation(onCancel)}
							>
								{metadata.locked ? 'Back' : 'Cancel'}
							</Button>
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
								{mode === 'create'
									? 'Save Draft'
									: 'Save Changes'}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</AdminForm>
	)
}
