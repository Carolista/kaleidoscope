import { faUserGear } from '@fortawesome/pro-solid-svg-icons'
import { PlayerIconButton } from '@/ui/components'

// The header's settings button. The page hosts the SettingsDialog it opens, since
// a dialog inside the header would inherit the header's font size and button sizing.
export default function SettingsControl({
	onOpen,
}: {
	readonly onOpen: () => void
}) {
	return (
		<PlayerIconButton
			icon={faUserGear}
			label="Settings"
			onClick={onOpen}
			aria-haspopup="dialog"
		/>
	)
}
