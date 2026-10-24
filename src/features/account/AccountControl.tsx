import { faCircleUser } from '@fortawesome/pro-solid-svg-icons'
import { PlayerIconButton } from '@/ui/components'
import { useAccount } from './AccountContext'

// The header's account button. It renders nothing when accounts are unavailable,
// so the app stays a plain guest app. The page hosts the AccountDialog it opens,
// since a dialog inside the header would inherit the header's font size and
// button sizing.
export default function AccountControl({
	onOpen,
}: {
	readonly onOpen: () => void
}) {
	const { status, firstName } = useAccount()
	if (status === 'unavailable') return null
	const label =
		status === 'signedIn'
			? `Account${firstName ? ` for ${firstName}` : ''}`
			: 'Sign in or create an account'
	return (
		<PlayerIconButton
			icon={faCircleUser}
			label={label}
			onClick={onOpen}
			aria-haspopup="dialog"
		/>
	)
}
