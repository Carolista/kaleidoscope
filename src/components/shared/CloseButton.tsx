import IconButton from './IconButton'

export interface CloseButtonProps {
	readonly label: string
	readonly onClick: () => void
}

// A thin IconButton wrapper rather than its own styling, so a modal's "×"
// close button always matches the rest of the app's icon buttons.
function CloseButton({ label, onClick }: CloseButtonProps) {
	return <IconButton icon="xmark" label={label} onClick={onClick} />
}

export default CloseButton
