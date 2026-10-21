import { Button } from '@/ui/components'
import type { DraftRecovery } from './useDraftRecovery'

export default function DraftRecoveryNotice({
	recovery,
	subject,
	replacesFields = false,
}: {
	readonly recovery: DraftRecovery
	readonly subject: string
	// True when the editor already shows fields that restoring would replace.
	readonly replacesFields?: boolean
}) {
	if (!recovery.pending) return null
	return (
		<section aria-label="Unsaved draft recovered">
			<p role="status">
				Unsaved changes to {subject} were found from an earlier session.
				{replacesFields
					? ' Restoring replaces the current fields.'
					: ''}
			</p>
			<Button type="button" variant="primary" onClick={recovery.restore}>
				Restore unsaved changes
			</Button>
			<Button type="button" onClick={recovery.discard}>
				Discard them
			</Button>
		</section>
	)
}
