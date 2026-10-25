import { useId } from 'react'
import { Button, Heading, Modal, ModalHeader } from '@/ui/components'
import styles from './RewardModal.module.css'

// For a guest on a device that has had an account: their solves are only on this device until they sign in.
export default function SignInNudgeModal({
	open,
	onClose,
	onAfterClose,
	onSignIn,
}: {
	readonly open: boolean
	readonly onClose: () => void
	readonly onAfterClose: () => void
	readonly onSignIn: () => void
}) {
	const titleId = useId()
	return (
		<Modal
			open={open}
			onClose={onClose}
			onAfterClose={onAfterClose}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<ModalHeader
					title="Playing as a guest"
					titleId={titleId}
					closeLabel="Close reminder"
					onClose={onClose}
				/>
			}
		>
			<div className={styles.content}>
				<section className={styles.reward}>
					<Heading level={3} className={styles.subheading}>
						Please sign in to continue saving your progress.
					</Heading>
					<p className={styles.text}>
						You aren&rsquo;t signed in, so your puzzles are saved
						only on this device. After you sign in, you can add them
						to your account.
					</p>
					<Button variant="primary" onClick={onSignIn}>
						Sign in
					</Button>
					<button
						type="button"
						className={styles.link}
						onClick={onClose}
					>
						Keep playing as a guest
					</button>
				</section>
			</div>
		</Modal>
	)
}
