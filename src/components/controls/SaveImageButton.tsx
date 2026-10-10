import { useState } from 'react'
import type { RefObject } from 'react'
import { faHexagonImage } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { IconButton } from '@shared'
import SaveImageModal from './SaveImageModal'

export interface SaveImageButtonProps {
	readonly svgRef: RefObject<SVGSVGElement | null>
}

function SaveImageButton({ svgRef }: SaveImageButtonProps) {
	const [open, setOpen] = useState(false)

	return (
		<>
			<IconButton
				icon={faHexagonImage}
				label="Download or share image of design"
				onClick={() => setOpen(true)}
			/>
			<SaveImageModal
				open={open}
				svgRef={svgRef}
				onClose={() => setOpen(false)}
			/>
		</>
	)
}

export default SaveImageButton
