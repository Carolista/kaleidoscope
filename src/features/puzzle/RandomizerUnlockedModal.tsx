import { useId } from 'react'
import { Button, Heading, Modal, ModalHeader } from '@/ui/components'
import styles from './RewardModal.module.css'

// The last prize: finishing every core and bonus set earns Zen's randomizer.
export default function RandomizerUnlockedModal({
	open,
	onClose,
	onAfterClose,
	onOpenZen,
}: {
	readonly open: boolean
	readonly onClose: () => void
	readonly onAfterClose: () => void
	readonly onOpenZen: () => void
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
					title="A very special reward"
					titleId={titleId}
					closeLabel="Close reward"
					onClose={onClose}
				/>
			}
		>
			<div className={styles.content}>
				<p className={styles.hooray}>You did it!</p>
				<section className={styles.reward}>
					<Heading level={3} className={styles.subheading}>
						Every puzzle set, solved!
					</Heading>
					<p className={styles.text}>
						You finished all 24 puzzle sets of 24 puzzles each. That
						takes real dedication, and it deserves something
						special.
					</p>
					<p className={styles.text}>
						Your reward is the <strong>Randomizer</strong> in Zen
						Mode: one tap creates a surprise design in your current
						palette.
					</p>
					<Button variant="primary" onClick={onOpenZen}>
						Try it out in Zen Mode now
					</Button>
				</section>
			</div>
		</Modal>
	)
}
