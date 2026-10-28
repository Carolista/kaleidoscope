import { useEffect, useState } from 'react'
import { faPalette } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { PlayerIconButton as IconButton } from '@/ui/components'
import { useNewChoices } from '@/ui/content'
import PaletteModal from './PaletteModal'

const NO_PALETTES: ReadonlySet<string> = new Set()

export interface PaletteButtonProps {
	// Opens the picker on arrival, as when following a palette reward into Zen.
	readonly initialOpen?: boolean
}

function PaletteButton({ initialOpen = false }: PaletteButtonProps) {
	const [open, setOpen] = useState(initialOpen)
	const { newPalettes, newPaletteIds, markPalettesSeen } = useNewChoices()
	// Opening the picker counts everything in it as seen, so what was new is kept
	// for the picker to tag while it is open.
	const [tagged, setTagged] = useState(() =>
		initialOpen ? newPaletteIds : NO_PALETTES,
	)

	useEffect(() => {
		if (initialOpen) markPalettesSeen()
		// Only on arrival; later opens mark them in the click handler.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<>
			<IconButton
				icon={faPalette}
				label={
					newPalettes
						? 'Select a different color palette (new palettes available)'
						: 'Select a different color palette'
				}
				badge={newPalettes}
				onClick={() => {
					setTagged(newPaletteIds)
					markPalettesSeen()
					setOpen(true)
				}}
			/>
			<PaletteModal
				open={open}
				onClose={() => setOpen(false)}
				newIds={tagged}
			/>
		</>
	)
}

export default PaletteButton
