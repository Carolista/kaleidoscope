import { useState } from 'react'
import { faPalette } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { PlayerIconButton as IconButton } from '@/ui/components'
import { useNewChoices } from '@/ui/content'
import PaletteModal from './PaletteModal'

function PaletteButton() {
	const [open, setOpen] = useState(false)
	const { newPalettes, markPalettesSeen } = useNewChoices()

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
					markPalettesSeen()
					setOpen(true)
				}}
			/>
			<PaletteModal open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export default PaletteButton
