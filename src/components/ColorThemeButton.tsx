import { useState } from 'react'
import styles from './ColorThemeButton.module.css'
import ColorThemeModal from './ColorThemeModal'

function ColorThemeButton() {
	const [open, setOpen] = useState(false)

	return (
		<>
			<button
				type="button"
				className={styles.button}
				aria-label="Open color theme picker"
				title="Open color theme picker"
				onClick={() => setOpen(true)}
			>
				<i className="fa-solid fa-palette fa-2x" aria-hidden="true"></i>
			</button>
			<ColorThemeModal open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export default ColorThemeButton
