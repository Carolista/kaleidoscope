import { useZenState } from '@/features/zen/state'
import { usePlayerContent } from '@/ui/content'
import { PaletteChoices } from '@/ui/components'

export interface PalettePickerProps {
	// Called right after a palette is selected, so the containing modal can
	// close itself instead of staying open on the now-applied picker.
	readonly onSelected?: () => void
}

// Clicking a row selects it as the current palette, which also resets the
// current paint color to the palette's first color (see the reducer's
// SELECT_PALETTE).
function PalettePicker({ onSelected }: PalettePickerProps) {
	const { state, selectPalette } = useZenState()
	const { palettes } = usePlayerContent()

	return (
		<PaletteChoices
			palettes={palettes}
			selectedId={state.currentPalette.id}
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
