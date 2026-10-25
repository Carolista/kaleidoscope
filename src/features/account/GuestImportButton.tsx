import { Button } from '@/ui/components'
import { usePlayerProgress } from '@/ui/content'

// Shown in a signed-in player's account view while guest progress is still waiting to be imported.
export default function GuestImportButton({
	onRequest,
}: {
	readonly onRequest: () => void
}) {
	const { guestImport } = usePlayerProgress()
	return guestImport ? (
		<Button onClick={onRequest}>Import progress from this device</Button>
	) : null
}
