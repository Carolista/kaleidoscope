import { Heading } from '@/ui/components'
import type { PlayerPuzzleSet } from '@/ui/content'
import { faCircleCheck, faCircle } from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import PuzzleImage from './PuzzleImage'
import styles from './PuzzleMode.module.css'
import { difficultySections, solvedCount } from './setProgress'

const trackLabels = {
	basic: 'Basic',
	rotation: 'Rotation',
} as const

const trackColors = {
	basic: ['--green', '--blue', '--purple'],
	rotation: ['--magenta', '--red', '--orange'],
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
			<Heading level={2} className={styles.heading}>
				Puzzle Sets
			</Heading>
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
									{set.name}{' '}
									{solvedCount(set.puzzles, solved) ===
										24 && (
										<FontAwesomeIcon
											icon={faCircleCheck}
											className={styles.setComplete}
											aria-hidden="true"
										/>
									)}
								</span>
								<span>
									<span
										className={styles.trackDots}
										aria-hidden="true"
									>
										{trackColors[set.track].map(color => (
											<FontAwesomeIcon
												key={color}
												icon={faCircle}
												style={{
													color: `var(${color})`,
												}}
											/>
										))}
									</span>
									{trackLabels[set.track]}
								</span>
								<span>
									{set.kind === 'bonus' ? ' (Bonus)' : ''}
								</span>
								<span className={styles.setTotalSolved}>
									{solvedCount(set.puzzles, solved)}/
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
										{section.puzzles[0].item.palette.name}
										<span>
											{solvedCount(
												section.puzzles.map(
													entry => entry.item,
												),
												solved,
											)}
											/{section.puzzles.length}
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
