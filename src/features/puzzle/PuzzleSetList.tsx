import { PUZZLE_SHAPE_LABELS } from '@/domain/puzzles'
import type { PlayerPuzzleSet } from '@/ui/content'
import { solvedCount } from './setProgress'
import styles from './PuzzleMode.module.css'

const trackLabels = {
	basic: 'Basic',
	rotation: 'Rotation',
} as const

export default function PuzzleSetList({
	sets,
	solved,
	onChoose,
}: {
	readonly sets: readonly PlayerPuzzleSet[]
	readonly solved: ReadonlySet<string>
	readonly onChoose: (setId: string) => void
}) {
	if (!sets.length)
		return (
			<p className={styles.empty}>
				No puzzles are available yet. Check back soon!
			</p>
		)
	return (
		<>
			<h2 className={styles.heading}>Puzzle sets</h2>
			<ul className={styles.setList}>
				{sets.map(set => (
					<li key={set.id}>
						<button
							type="button"
							className={styles.setButton}
							onClick={() => onChoose(set.id)}
						>
							<span className={styles.setName}>{set.name}</span>
							<span>
								{PUZZLE_SHAPE_LABELS[set.shape]} ·{' '}
								{trackLabels[set.track]}
							</span>
							<span>
								{solvedCount(set, solved)} of{' '}
								{set.puzzles.length} solved
							</span>
						</button>
					</li>
				))}
			</ul>
		</>
	)
}
