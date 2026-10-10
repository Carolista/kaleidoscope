import { useState } from 'react'
import { faPalette } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { IconButton } from '@shared'
import ColorSchemeModal from './ColorSchemeModal'

function ColorSchemeButton() {
	const [open, setOpen] = useState(false)

	return (
		<>
			<IconButton
				icon={faPalette}
				label="Select a different color palette"
				onClick={() => setOpen(true)}
			/>
			<ColorSchemeModal open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export default ColorSchemeButton
