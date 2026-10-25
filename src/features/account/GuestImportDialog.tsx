import { useId, useState } from 'react'
import { Button, Modal, ModalHeader } from '@/ui/components'
import { usePlayerProgress } from '@/ui/content'
import styles from './AccountDialog.module.css'

// Offers a signed-in player the puzzles they solved as a guest on this device. It opens by itself
// until they answer, and afterwards only when `requested`. Nothing is moved without a yes,
// and the guest save is left in place either way.
export default function GuestImportDialog({
	requested,
	suspended,
	onClose,
}: {
	// The player asked for the offer again.
	readonly requested: boolean
	// Another dialog is on screen; wait for it.
	readonly suspended: boolean
	readonly onClose: () => void
}) {
	const { guestImport } = usePlayerProgress()
	const titleId = useId()
	const [working, setWorking] = useState(false)
	const [failed, setFailed] = useState(false)
	// Kept so the wording does not change while the dialog fades out after a successful import.
	const [count, setCount] = useState(0)
	if (guestImport && guestImport.count !== count) setCount(guestImport.count)
	const open =
		!!guestImport && (guestImport.offered || requested) && !suspended

	function decline() {
		guestImport?.decline()
		onClose()
	}

	async function importProgress() {
		if (!guestImport) return
		setWorking(true)
		setFailed(false)
		const done = await guestImport.run()
		setWorking(false)
		if (done) onClose()
		else setFailed(true)
	}

	return (
		<Modal
			open={open}
			onClose={decline}
			onAfterClose={() => setFailed(false)}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<ModalHeader
					title="Import your progress?"
					titleId={titleId}
					closeLabel="Close without importing"
					onClose={decline}
				/>
			}
		>
			<div className={styles.content}>
				<p>
					You solved {count} puzzle{count === 1 ? '' : 's'} as a guest
					on this device. Import {count === 1 ? 'it' : 'them'} to keep
					that progress in your account, along with anything it earns.
				</p>
				<p>Your guest save stays on this device either way.</p>
				{failed && (
					<p className={styles.error} role="alert">
						We couldn&rsquo;t import your progress right now. Please
						try again in a little while.
					</p>
				)}
				<Button
					variant="primary"
					onClick={() => void importProgress()}
					disabled={working}
				>
					{working ? 'Importing…' : 'Import progress'}
				</Button>
				<button
					type="button"
					className={styles.link}
					onClick={decline}
					disabled={working}
				>
					Not now
				</button>
			</div>
		</Modal>
	)
}
