import { useState } from 'react'
import { IconButton } from '@shared'
import ColorThemeModal from './ColorThemeModal'

function ColorThemeButton() {
	const [open, setOpen] = useState(false)

	return (
		<>
			<IconButton
				icon="palette"
				label="Open color theme picker"
				onClick={() => setOpen(true)}
			/>
			<ColorThemeModal open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export default ColorThemeButton
