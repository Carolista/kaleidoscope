import { useState } from 'react'
import { faCircleInfo } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { IconButton } from '@shared'
import ControlsModal from './ControlsModal'

interface ControlsInfoButtonProps {
	readonly initialOpen?: boolean
}

function ControlsInfoButton({ initialOpen = false }: ControlsInfoButtonProps) {
	const [open, setOpen] = useState(initialOpen)

	return (
		<>
			<IconButton
				icon={faCircleInfo}
				label="Show controls help"
				onClick={() => setOpen(true)}
			/>
			<ControlsModal open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export default ControlsInfoButton
