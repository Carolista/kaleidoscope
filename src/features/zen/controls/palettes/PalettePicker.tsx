import { useZenState } from '@/features/zen/state'
import { usePlayerContent } from '@/ui/content'
import { PaletteChoices } from '@/ui/components'

export interface PalettePickerProps {
	// Palettes the player has not seen before, tagged "NEW!".
	readonly newIds?: ReadonlySet<string>
	// Called right after a palette is selected, so the containing modal can
	// close itself instead of staying open on the now-applied picker.
	readonly onSelected?: () => void
}

// Clicking a row selects it as the current palette, which also resets the
// current paint color to the palette's first color (see the reducer's
// SELECT_PALETTE).
function PalettePicker({ newIds, onSelected }: PalettePickerProps) {
	const { state, selectPalette } = useZenState()
	const { palettes, lockedPalettes } = usePlayerContent()

	return (
		<PaletteChoices
			palettes={palettes}
			locked={lockedPalettes.map(({ item, unlockedBy }) => ({
				...item,
				requirement: `Finish ${unlockedBy} to unlock`,
			}))}
			selectedId={state.currentPalette.id}
			newIds={newIds}
			onSelect={id => {
				const palette = palettes.find(palette => palette.id === id)
				if (!palette) throw new Error(`Unknown player palette: ${id}`)
				selectPalette(palette)
				onSelected?.()
			}}
		/>
	)
}

export default PalettePicker
