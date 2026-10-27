import { useEffect, useId, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faAt,
	faKey,
	faRightFromBracket,
	faRightToBracket,
} from '@fortawesome/pro-solid-svg-icons'
import { useAccount } from '@/features/account'
import {
	Button,
	DarkModeToggle,
	Heading,
	Modal,
	ModalHeader,
} from '@/ui/components'
import ChangeEmailForm from './ChangeEmailForm'
import ChangePasswordForm from './ChangePasswordForm'
import WhenProgressToImport from './WhenProgressToImport'
import styles from './SettingsDialog.module.css'

type Editing = 'email' | 'password' | null

// Account details and game settings in one place. The page hosts it so it does
// not inherit the header's sizing.
export default function SettingsDialog({
	open,
	onClose,
	onSignIn,
	onImportProgress,
	showGameSettings = true,
}: {
	readonly open: boolean
	readonly onClose: () => void
	// Hands over to the sign-in dialog; set where accounts can be created.
	readonly onSignIn?: () => void
	// Set once the player's progress is loaded, which importing needs.
	readonly onImportProgress?: () => void
	readonly showGameSettings?: boolean
}) {
	const liveAccount = useAccount()
	const titleId = useId()
	const [editing, setEditing] = useState<Editing>(null)
	const emailButtonRef = useRef<HTMLButtonElement>(null)
	const passwordButtonRef = useRef<HTMLButtonElement>(null)
	// The form that was just closed, so focus can go back to the button that opened it.
	const returnFocusTo = useRef<Editing>(null)
	const [notice, setNotice] = useState('')
	const [signingOut, setSigningOut] = useState(false)
	const [signOutError, setSignOutError] = useState('')
	// What is shown follows the account only while the dialog is open and not
	// signing out, so signing out never swaps the content while it fades away.
	const [account, setAccount] = useState(liveAccount)
	if (open && !signingOut && account !== liveAccount) {
		setAccount(liveAccount)
	}
	const signedIn = account.status === 'signedIn'
	const guest = account.status === 'signedOut'

	useEffect(() => {
		if (editing || !returnFocusTo.current) return
		const button =
			returnFocusTo.current === 'email'
				? emailButtonRef.current
				: passwordButtonRef.current
		returnFocusTo.current = null
		button?.focus()
	}, [editing])

	function edit(next: Editing) {
		setNotice('')
		setEditing(next)
	}

	function closeForm() {
		returnFocusTo.current = editing
		setEditing(null)
	}

	function reset() {
		returnFocusTo.current = null
		setEditing(null)
		setNotice('')
		setSigningOut(false)
		setSignOutError('')
	}

	async function signOut() {
		setSigningOut(true)
		setSignOutError('')
		const result = await liveAccount.signOut()
		if (result.status === 'error') {
			setSignOutError(result.message)
			setSigningOut(false)
		} else {
			onClose()
		}
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			onAfterClose={reset}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<ModalHeader
					title="Settings"
					titleId={titleId}
					closeLabel="Close settings"
					onClose={onClose}
				/>
			}
		>
			<div className={styles.content}>
				{signedIn && (
					<>
						<div className={styles.who}>
							<p className={styles.greeting}>
								{account.firstName
									? `Hi, ${account.firstName}!`
									: 'Hello!'}
							</p>
							<Button
								className={styles.withIcon}
								onClick={() => void signOut()}
								disabled={signingOut}
							>
								<FontAwesomeIcon
									icon={faRightFromBracket}
									aria-hidden="true"
								/>
								{signingOut ? 'Signing out…' : 'Sign out'}
							</Button>
						</div>
						{signOutError && (
							<p className={styles.error} role="alert">
								{signOutError}
							</p>
						)}
						<section
							className={styles.section}
							aria-labelledby={`${titleId}-user`}
						>
							<Heading
								level={3}
								id={`${titleId}-user`}
								className={styles.heading}
							>
								User settings
							</Heading>
							<p className={styles.email}>
								<span className="visually-hidden">Email: </span>
								{account.email}
							</p>
							{account.pendingEmail && (
								<p className={styles.note} role="status">
									Confirmation sent to{' '}
									<strong>{account.pendingEmail}</strong>.
									Open the link there to finish the change.
								</p>
							)}
							{notice && (
								<p className={styles.note} role="status">
									{notice}
								</p>
							)}
							{!editing && (
								<div className={styles.actions}>
									<Button
										ref={emailButtonRef}
										className={styles.withIcon}
										onClick={() => edit('email')}
									>
										<FontAwesomeIcon
											icon={faAt}
											aria-hidden="true"
										/>
										Change email
									</Button>
									<Button
										ref={passwordButtonRef}
										className={styles.withIcon}
										onClick={() => edit('password')}
									>
										<FontAwesomeIcon
											icon={faKey}
											aria-hidden="true"
										/>
										Change password
									</Button>
								</div>
							)}
							{editing === 'email' && (
								<ChangeEmailForm
									onSaved={closeForm}
									onCancel={closeForm}
								/>
							)}
							{editing === 'password' && (
								<ChangePasswordForm
									onSaved={() => {
										closeForm()
										setNotice(
											'Your password has been updated.',
										)
									}}
									onCancel={closeForm}
								/>
							)}
						</section>
						{onImportProgress && (
							<WhenProgressToImport>
								<section
									className={styles.section}
									aria-labelledby={`${titleId}-import`}
								>
									<Heading
										level={3}
										id={`${titleId}-import`}
										className={styles.heading}
									>
										Import progress
									</Heading>
									<p>
										You solved puzzles as a guest on this
										device. Import them to keep that
										progress in your account, along with
										anything it earns.
									</p>
									<Button onClick={onImportProgress}>
										Import progress from this device
									</Button>
								</section>
							</WhenProgressToImport>
						)}
					</>
				)}
				{guest && onSignIn && (
					<section
						className={styles.section}
						aria-labelledby={`${titleId}-account`}
					>
						<Heading
							level={3}
							id={`${titleId}-account`}
							className={styles.heading}
						>
							Account
						</Heading>
						<p>
							Sign in or create an account to save your progress
							and unlock more shapes.
						</p>
						<Button className={styles.withIcon} onClick={onSignIn}>
							<FontAwesomeIcon
								icon={faRightToBracket}
								aria-hidden="true"
							/>
							Sign in or create an account
						</Button>
					</section>
				)}
				{showGameSettings && (
					<section
						className={styles.section}
						aria-labelledby={`${titleId}-game`}
					>
						<Heading
							level={3}
							id={`${titleId}-game`}
							className={styles.heading}
						>
							Game settings
						</Heading>
						<DarkModeToggle />
					</section>
				)}
			</div>
		</Modal>
	)
}
