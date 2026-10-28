import { useId } from 'react'
import { Heading, Modal, ModalHeader, PaletteStrip } from '@/ui/components'
import type { NewRewards, PlayerPuzzleSet } from '@/ui/content'
import UnlockedSetItem from './UnlockedSetItem'
import styles from './RewardModal.module.css'

// Announces what finishing a set just earned: palettes to try in Zen, and bonus sets to play.
export default function RewardModal({
	open,
	rewards,
	onClose,
	onAfterClose,
	onOpenZen,
	onOpenSet,
}: {
	readonly open: boolean
	readonly rewards: NewRewards
	readonly onClose: () => void
	readonly onAfterClose: () => void
	readonly onOpenZen: () => void
	readonly onOpenSet: (set: PlayerPuzzleSet) => void
}) {
	const titleId = useId()
	const { palettes, bonusSets } = rewards
	return (
		<Modal
			open={open}
			onClose={onClose}
			onAfterClose={onAfterClose}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<ModalHeader
					title="Reward earned"
					titleId={titleId}
					closeLabel="Close reward"
					onClose={onClose}
				/>
			}
		>
			<div className={styles.content}>
				<p className={styles.hooray}>Hooray!</p>
				{palettes.length > 0 && (
					<section className={styles.reward}>
						<Heading level={3} className={styles.subheading}>
							New palette{palettes.length === 1 ? '' : 's'}{' '}
							unlocked
						</Heading>
						{palettes.map(palette => (
							<div key={palette.id} className={styles.item}>
								<span className={styles.palette}>
									<PaletteStrip
										colors={palette.colors}
										variant="continuous"
									/>
								</span>
								<span className={styles.name}>
									{palette.name}
								</span>
							</div>
						))}
						<button
							type="button"
							className={styles.link}
							onClick={onOpenZen}
						>
							Try it out in Zen Mode now!
						</button>
					</section>
				)}
				{bonusSets.length > 0 && (
					<section className={styles.reward}>
						<Heading level={3} className={styles.subheading}>
							New puzzle set{bonusSets.length === 1 ? '' : 's'}{' '}
							unlocked
						</Heading>
						{bonusSets.map(set => (
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
