import type { PlayerPuzzleSet } from '@/ui/content'
import PuzzleImage from './PuzzleImage'
import { difficultySections } from './setProgress'
import styles from './RewardModal.module.css'

// A newly unlocked set in a reward dialog: a preview of each difficulty, its name, and a way in.
export default function UnlockedSetItem({
	set,
	onOpenSet,
}: {
	readonly set: PlayerPuzzleSet
	readonly onOpenSet: (set: PlayerPuzzleSet) => void
}) {
	return (
		<div className={styles.item}>
			<span className={styles.previews}>
				{difficultySections(set).map(section => (
					<span
						key={section.difficulty}
						className={styles.preview}
						aria-hidden="true"
					>
						<PuzzleImage item={section.puzzles[0].item} />
					</span>
				))}
			</span>
			<span className={styles.name}>{set.name}</span>
			<button
				type="button"
				className={styles.link}
				onClick={() => onOpenSet(set)}
			>
				Go to puzzle set now
			</button>
		</div>
	)
}
