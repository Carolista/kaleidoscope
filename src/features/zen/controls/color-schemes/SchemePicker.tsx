import { colorSchemes } from '@/domain/palettes'
import { useAppState } from '@/features/zen/state'
import { PaletteChoices } from '@/ui/components'

const choices = colorSchemes.map(scheme => ({ ...scheme, id: scheme.name }))

export interface SchemePickerProps {
	// Called right after a scheme is selected, so the containing modal can
	// close itself instead of staying open on the now-applied picker.
	readonly onSelected?: () => void
}

// Clicking a row selects it as the current scheme, which also resets the
// current paint color to the scheme's first color (see the reducer's
// SELECT_SCHEME).
function SchemePicker({ onSelected }: SchemePickerProps) {
	const { state, selectScheme } = useAppState()

	return (
		<PaletteChoices
			palettes={choices}
			selectedId={state.currentScheme.name}
			onSelect={id => {
				const scheme = colorSchemes.find(scheme => scheme.name === id)
				if (!scheme) throw new Error(`Unknown player palette: ${id}`)
				selectScheme(scheme)
				onSelected?.()
			}}
		/>
	)
}

export default SchemePicker
