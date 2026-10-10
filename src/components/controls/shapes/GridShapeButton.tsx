import { useState } from 'react'
import { faShapes } from '@fortawesome/pro-solid-svg-icons'
import { IconButton } from '@shared'
import GridShapeModal from './GridShapeModal'

function GridShapeButton() {
	const [open, setOpen] = useState(false)

	return (
		<>
			<IconButton
				icon={faShapes}
				label="Select a different shape"
				onClick={() => setOpen(true)}
			/>
			<GridShapeModal open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export default GridShapeButton
