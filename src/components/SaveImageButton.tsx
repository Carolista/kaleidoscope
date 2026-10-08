import { useState } from 'react'
import type { RefObject } from 'react'
import styles from './SaveImageButton.module.css'
import SaveImageModal from './SaveImageModal'

export interface SaveImageButtonProps {
	readonly svgRef: RefObject<SVGSVGElement | null>
}

function SaveImageButton({ svgRef }: SaveImageButtonProps) {
	const [open, setOpen] = useState(false)

	return (
		<>
			<button
				type="button"
				className={styles.button}
				aria-label="Save design as image"
				title="Save design as image"
				onClick={() => setOpen(true)}
			>
				<i className="fa-solid fa-image fa-2x" aria-hidden="true"></i>
			</button>
			<SaveImageModal
				open={open}
				svgRef={svgRef}
				onClose={() => setOpen(false)}
			/>
		</>
	)
}

export default SaveImageButton
