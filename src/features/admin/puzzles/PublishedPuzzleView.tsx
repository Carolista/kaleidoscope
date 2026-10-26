import {
	PUZZLE_SHAPE_LABELS,
	renderAuthoredPuzzle,
	type AuthoringPalette,
} from '@/domain/puzzles'
import { AdminSectionHeading } from '@/features/admin/common'
import { releaseStateLabel } from '@/features/admin/release'
import type { LibraryDraft } from '@/features/admin/services'
import { Button } from '@/ui/components'
import { PuzzleBoard } from '@/ui/puzzle'

// Live puzzles can no longer be changed, so they open read-only.
export default function PublishedPuzzleView({
	puzzle,
	palettes,
	onBack,
}: {
	readonly puzzle: LibraryDraft
	readonly palettes: readonly AuthoringPalette[]
	readonly onBack: () => void
}) {
	const palette = palettes.find(value => value.id === puzzle.row.palette_id)
	const preview = palette
		? renderAuthoredPuzzle(puzzle.puzzle, palette)
		: null
	return (
		<section aria-labelledby="prepared-puzzle-title">
			<AdminSectionHeading
				id="prepared-puzzle-title"
				title={`${puzzle.row.name} (read-only)`}
			>
				<Button variant="outline" onClick={onBack}>
					Back to puzzles
				</Button>
			</AdminSectionHeading>
			<p>Live puzzles can no longer be changed.</p>
			{preview ? (
				<PuzzleBoard
					target
					label={`${puzzle.row.name} design`}
					shape={preview.shape}
					gridSize={preview.gridSize}
					colors={preview.target}
				/>
			) : (
				<p>Palette unavailable.</p>
			)}
			<dl>
				<dt>Shape</dt>
				<dd>{PUZZLE_SHAPE_LABELS[puzzle.puzzle.shape]}</dd>
				<dt>Recipe</dt>
				<dd>{puzzle.puzzle.recipe.label}</dd>
				<dt>Palette</dt>
				<dd>{palette?.name ?? puzzle.row.palette_id}</dd>
				<dt>Group</dt>
				<dd>{puzzle.groupName ?? 'None'}</dd>
				<dt>Status</dt>
				<dd>{releaseStateLabel(puzzle.row)}</dd>
			</dl>
		</section>
	)
}
