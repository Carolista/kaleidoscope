import {
	faArrowLeft,
	faCheck,
} from '@fortawesome/sharp-duotone-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PUZZLE_DIFFICULTY_LABELS } from '@/domain/puzzles'
import { PlayerIconButton } from '@/ui/components'
import type { PlayerPuzzleSet } from '@/ui/content'
import { solvedCount } from './setProgress'
import styles from './PuzzleMode.module.css'

export default function PuzzleGrid({
	set,
	solved,
	onChoose,
	onBack,
}: {
	readonly set: PlayerPuzzleSet
	readonly solved: ReadonlySet<string>
	readonly onChoose: (puzzleId: string) => void
	readonly onBack: () => void
}) {
	return (
		<>
			<div className={styles.titleRow}>
				<PlayerIconButton
					icon={faArrowLeft}
					label="All puzzle sets"
					onClick={onBack}
				/>
				<h2 className={styles.heading}>{set.name}</h2>
			</div>
			<p className={styles.progress}>
				{solvedCount(set, solved)} of {set.puzzles.length} solved
			</p>
			<ol className={styles.puzzleGrid}>
				{set.puzzles.map((item, index) => {
					const done = solved.has(item.id)
					return (
						<li key={item.id}>
							<button
								type="button"
								className={`${styles.puzzleButton}${done ? ` ${styles.solved}` : ''}`}
								aria-label={`Puzzle ${index + 1}, ${PUZZLE_DIFFICULTY_LABELS[item.difficulty]}${done ? ', solved' : ''}`}
								onClick={() => onChoose(item.id)}
							>
								<span className={styles.number}>
									{index + 1}
								</span>
								<span className={styles.difficulty}>
									{PUZZLE_DIFFICULTY_LABELS[item.difficulty]}
								</span>
								{done && (
									<FontAwesomeIcon
										icon={faCheck}
										aria-hidden="true"
										className={styles.check}
									/>
								)}
							</button>
						</li>
					)
				})}
			</ol>
		</>
	)
}
