import type { PlayerPuzzleSet } from '@/ui/content'
import PuzzleImage from './PuzzleImage'
import { difficultySections, solvedCount } from './setProgress'
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
			<h2 className={styles.heading}>Puzzle Sets</h2>
			<ul className={styles.setList}>
				{sets.map(set => (
					<li key={set.id}>
						<button
							type="button"
							className={styles.setButton}
							onClick={() => onChoose(set.id)}
						>
							<span className={styles.setText}>
								<span className={styles.setName}>
									{set.name}
								</span>
								<span>{trackLabels[set.track]}</span>
								<span>
									{solvedCount(set.puzzles, solved)} of{' '}
									{set.puzzles.length}
								</span>
							</span>
							<span className={styles.previews}>
								{difficultySections(set).map(section => (
									<span
										key={section.difficulty}
										className={styles.preview}
									>
										<span
											className={styles.previewImage}
											aria-hidden="true"
										>
											<PuzzleImage
												item={section.puzzles[0].item}
											/>
										</span>
										<span>
											{solvedCount(
												section.puzzles.map(
													entry => entry.item,
												),
												solved,
											)}{' '}
											of {section.puzzles.length}
										</span>
									</span>
								))}
							</span>
						</button>
					</li>
				))}
			</ul>
		</>
	)
}
