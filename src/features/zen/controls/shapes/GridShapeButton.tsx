import { useState } from 'react'
import { faShapes } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { PlayerIconButton as IconButton } from '@/ui/components'
import { useNewChoices } from '@/ui/content'
import GridShapeModal from './GridShapeModal'

function GridShapeButton() {
	const [open, setOpen] = useState(false)
	const { newShapes, markShapesSeen } = useNewChoices()

	return (
		<>
			<IconButton
				icon={faShapes}
				label={
					newShapes
						? 'Select a different shape (new shapes available)'
						: 'Select a different shape'
				}
				badge={newShapes}
				onClick={() => {
					markShapesSeen()
					setOpen(true)
				}}
			/>
			<GridShapeModal open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export default GridShapeButton
