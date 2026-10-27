import { useId } from 'react'
import { PUZZLE_SHAPE_LABELS } from '@/domain/puzzles'
import type { GridShapeId } from '@/domain/shapes'
import { Button, Heading, Modal, ModalHeader } from '@/ui/components'
import styles from './RewardModal.module.css'

// Offered once, to a guest who has finished every set open to them: the next shape needs an account.
export default function AccountPromptModal({
	open,
	shape,
	onClose,
	onAfterClose,
	onCreateAccount,
}: {
	readonly open: boolean
	readonly shape: GridShapeId
	readonly onClose: () => void
	readonly onAfterClose: () => void
	readonly onCreateAccount: () => void
}) {
	const titleId = useId()
	const shapeName = PUZZLE_SHAPE_LABELS[shape]
	return (
		<Modal
			open={open}
			onClose={onClose}
			onAfterClose={onAfterClose}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<ModalHeader
					title="Ready for more?"
					titleId={titleId}
					closeLabel="Close prompt"
					onClose={onClose}
				/>
			}
		>
			<div className={styles.content}>
				<p className={styles.hooray}>Hooray!</p>
				<section className={styles.reward}>
					<Heading level={3} className={styles.subheading}>
						You&rsquo;ve finished every puzzle set open to guests.
					</Heading>
					<p className={styles.text}>
						Create a free account to unlock {shapeName}, with new
						puzzle sets and a new shape to design with in Zen Mode.
					</p>
					<Button variant="primary" onClick={onCreateAccount}>
						Sign in or create an account
					</Button>
					<button
						type="button"
						className={styles.link}
						onClick={onClose}
					>
						Keep playing as a guest
					</button>
					<p className={styles.text}>
						Zen Mode stays open to you with all of your palettes.
					</p>
				</section>
			</div>
		</Modal>
	)
}
