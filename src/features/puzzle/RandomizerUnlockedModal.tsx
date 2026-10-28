import { Button, Heading, Modal, ModalHeader } from '@/ui/components'
import { faMagicWandSparkles } from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useId } from 'react'
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
				<p className={styles.hooray}>Awesome job!</p>
				<section className={styles.reward}>
					<Heading level={3} className={styles.subheading}>
						You're a Master Solver.
					</Heading>
					<p className={styles.text}>
						You completed all <strong>24 core puzzle sets</strong> —
						576 puzzles in total. That takes real dedication, and it
						deserves something special!
					</p>
					<p className={styles.text}>
						UNLOCKED
						<br />
						<strong>Zen Mode Randomizer</strong>
					</p>
					<p>
						Generate stunning new designs instantly with the tap of
						a button!
					</p>
					<p className={styles.text}>
						Look for the sparkling magic wand:
					</p>
					<span className={styles.icon}>
						<FontAwesomeIcon icon={faMagicWandSparkles} />
					</span>

					<Button variant="primary" onClick={onOpenZen}>
						Try it out in Zen Mode now!
					</Button>
				</section>
			</div>
		</Modal>
	)
}
