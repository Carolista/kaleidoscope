import { PUZZLE_DIFFICULTY_LABELS } from '@/domain/puzzles'
import { Heading, PlayerIconButton } from '@/ui/components'
import type { PlayerPuzzleSet } from '@/ui/content'
import { faArrowLeft } from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/sharp-duotone-solid-svg-icons'
import PuzzleImage from './PuzzleImage'
import styles from './PuzzleMode.module.css'
import { difficultySections, solvedCount } from './setProgress'

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
				<Heading level={2} className={styles.heading}>
					{set.name}
				</Heading>
			</div>
			<p className={styles.progress}>
				{solvedCount(set.puzzles, solved)} of {set.puzzles.length}
			</p>
			{difficultySections(set).map(section => {
				const label = PUZZLE_DIFFICULTY_LABELS[section.difficulty]
				return (
					<section
						key={section.difficulty}
						className={styles.section}
						aria-label={label}
					>
						<Heading level={3} className={styles.subheading}>
							{label}
						</Heading>
						<ul className={styles.puzzleGrid}>
							{section.puzzles.map(({ item, number }) => {
								const done = solved.has(item.id)
								return (
									<li key={item.id}>
										<button
											type="button"
											className={styles.puzzleButton}
											aria-label={`Puzzle ${number}, ${label}${done ? ', solved' : ''}`}
											onClick={() => onChoose(item.id)}
										>
											<span
												className={styles.puzzleImage}
												aria-hidden="true"
											>
												<PuzzleImage item={item} />
											</span>
											{done && (
												<span
													className={styles.check}
													aria-hidden="true"
												>
													<FontAwesomeIcon
														icon={faCheck}
													/>
												</span>
											)}
										</button>
									</li>
								)
							})}
						</ul>
					</section>
				)
			})}
		</>
	)
}
