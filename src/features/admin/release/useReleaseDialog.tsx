import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { useModalState } from '@/ui/hooks'
import ReleaseDialog, { type ReleaseTarget } from './ReleaseDialog'
import { releaseStatusMessage } from './releaseText'

// Owns the release dialog for a screen: `start` opens it for a target, `dialog` is the element
// to render, and `onDone` receives the confirmation sentence once the release has changed.
export default function useReleaseDialog(
	client: SupabaseClient<Database>,
	onDone: (message: string) => void,
) {
	const [target, setTarget, modal] = useModalState<ReleaseTarget>()
	const dialog = target ? (
		<ReleaseDialog
			{...modal}
			client={client}
			target={target}
			onCancel={() => setTarget(null)}
			onDone={plan => {
				setTarget(null)
				onDone(releaseStatusMessage(plan))
			}}
		/>
	) : null
	return { start: setTarget, dialog, active: target !== null }
}
