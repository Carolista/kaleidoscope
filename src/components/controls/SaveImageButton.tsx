import { useState } from 'react'
import type { RefObject } from 'react'
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
				icon="image"
				label="Create image from design"
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
