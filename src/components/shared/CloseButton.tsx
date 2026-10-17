import { faXmark } from '@fortawesome/pro-solid-svg-icons'
import IconButton from './IconButton'
import type { IconButtonSize } from './IconButton'

export interface CloseButtonProps {
	readonly label: string
	readonly onClick: () => void
	readonly size?: IconButtonSize
}

// A thin IconButton wrapper rather than its own styling, so a modal's "×"
// close button always matches the rest of the app's icon buttons.
function CloseButton({ label, onClick, size }: CloseButtonProps) {
	return (
		<IconButton
			icon={faXmark}
			label={label}
			onClick={onClick}
			size={size}
		/>
	)
}

export default CloseButton
