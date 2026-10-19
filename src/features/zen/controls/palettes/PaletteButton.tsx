import { useState } from 'react'
import { faPalette } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { PlayerIconButton as IconButton } from '@/ui/components'
import PaletteModal from './PaletteModal'

function PaletteButton() {
	const [open, setOpen] = useState(false)

	return (
		<>
			<IconButton
				icon={faPalette}
				label="Select a different color palette"
				onClick={() => setOpen(true)}
			/>
			<PaletteModal open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export default PaletteButton
