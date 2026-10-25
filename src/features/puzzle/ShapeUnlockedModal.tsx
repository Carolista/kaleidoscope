import { useId } from 'react'
import { PUZZLE_SHAPE_LABELS } from '@/domain/puzzles'
import { Heading, Modal, ModalHeader } from '@/ui/components'
import type { PlayerPuzzleSet, UnlockedShape } from '@/ui/content'
import UnlockedSetItem from './UnlockedSetItem'
import styles from './RewardModal.module.css'

// Announces the shape a finished set opened in Zen Mode, then the core sets that came with it.
export default function ShapeUnlockedModal({
	open,
	shapes,
	onClose,
	onAfterClose,
	onOpenZen,
	onOpenSet,
}: {
	readonly open: boolean
	readonly shapes: readonly UnlockedShape[]
	readonly onClose: () => void
	readonly onAfterClose: () => void
	readonly onOpenZen: () => void
	readonly onOpenSet: (set: PlayerPuzzleSet) => void
}) {
	const titleId = useId()
	const names = shapes.map(({ shape }) => PUZZLE_SHAPE_LABELS[shape])
	const plural = shapes.length > 1
	const sets = shapes.flatMap(item => item.sets)
	return (
		<Modal
			open={open}
			onClose={onClose}
			onAfterClose={onAfterClose}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<ModalHeader
					title={
						plural ? 'New shapes unlocked' : 'New shape unlocked'
					}
					titleId={titleId}
					closeLabel="Close announcement"
					onClose={onClose}
				/>
			}
		>
			<div className={styles.content}>
				<section className={styles.reward}>
					<Heading level={3} className={styles.subheading}>
						{names.join(' and ')} {plural ? 'are' : 'is'} now
						unlocked in Zen Mode!
					</Heading>
					<button
						type="button"
						className={styles.link}
						onClick={onOpenZen}
					>
						Try it out in Zen Mode now!
					</button>
				</section>
				{sets.length > 0 && (
					<section className={styles.reward}>
						<Heading level={3} className={styles.subheading}>
							New puzzle set{sets.length === 1 ? '' : 's'}{' '}
							unlocked:
						</Heading>
						{sets.map(set => (
							<UnlockedSetItem
								key={set.id}
								set={set}
								onOpenSet={onOpenSet}
							/>
						))}
					</section>
				)}
			</div>
		</Modal>
	)
}
