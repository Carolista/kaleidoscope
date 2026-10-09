import { useState } from 'react'
import IconButton from '../../shared/IconButton'
import GridShapeModal from './GridShapeModal'

function GridShapeButton() {
	const [open, setOpen] = useState(false)

	return (
		<>
			<IconButton
				icon="shapes"
				label="Open grid shape picker"
				onClick={() => setOpen(true)}
			/>
			<GridShapeModal open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export default GridShapeButton
