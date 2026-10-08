import { useState } from 'react'
import styles from './SettingsButton.module.css'
import SettingsModal from './SettingsModal'

function SettingsButton() {
	const [open, setOpen] = useState(false)

	return (
		<>
			<button
				type="button"
				className={styles.button}
				aria-label="Open settings"
				title="Open settings"
				onClick={() => setOpen(true)}
			>
				<i className="fa-solid fa-gear fa-2x" aria-hidden="true"></i>
			</button>
			<SettingsModal open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export default SettingsButton
