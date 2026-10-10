import { useState } from 'react'
import { faCircleInfo } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { hasPersistedDesign } from '@services/storageService'
import { IconButton } from '@shared'
import ControlsModal from './ControlsModal'

// Opens once automatically the first time anyone plays on a device (no
// design ever saved there — mirrors the "first-ever visit" check the old
// touch-only intro modal used, via hasPersistedDesign() in
// storageService.ts, captured once before the autosave effect in
// AppContext can persist anything). After that it only opens when the
// user taps this icon.
function ControlsInfoButton() {
	const [open, setOpen] = useState(() => !hasPersistedDesign())

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
