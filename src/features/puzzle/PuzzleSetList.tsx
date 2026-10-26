import { supportedGridShapes } from '@/domain/shapes'
import { Heading } from '@/ui/components'
import type { Locked, PlayerPuzzleSet } from '@/ui/content'
import { usePressPreview } from '@/ui/hooks'
import {
	faCircleCheck,
	faCircle,
	faLock,
} from '@fortawesome/pro-solid-svg-icons'
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

function TrackLabel({ set }: { readonly set: PlayerPuzzleSet }) {
	return (
		<>
			<span className={styles.trackDots} aria-hidden="true">
				{trackColors[set.track].map(color => (
					<FontAwesomeIcon
						key={color}
						icon={faCircle}
						style={{ color: `var(${color})` }}
					/>
				))}
			</span>
			{trackLabels[set.track]}
		</>
	)
}

// A set not yet earned: it cannot be opened, but pressing it previews its colors.
// It uses aria-disabled rather than disabled so it still receives pointer events and focus.
function LockedSetButton({ item: set, unlockedBy }: Locked<PlayerPuzzleSet>) {
	const press = usePressPreview()
	const shape =
		supportedGridShapes.find(item => item.id === set.shape)?.label ??
		set.shape
	const bonus = set.kind === 'bonus' ? ', bonus' : ''
	return (
		<button
			type="button"
			className={`${styles.setButton} ${styles.lockedSet}`}
			aria-disabled="true"
			aria-label={`${set.name}, ${shape} ${trackLabels[set.track]}${bonus} set, locked. Finish ${unlockedBy} to unlock`}
			{...press}
		>
			<span className={styles.setText}>
				<span className={styles.setName}>{set.name}</span>
				<span>{shape}</span>
				<span>
					<TrackLabel set={set} />
				</span>
				{set.kind === 'bonus' && <span>(Bonus)</span>}
				<span className={styles.lockedRequirement}>
					<FontAwesomeIcon icon={faLock} aria-hidden="true" /> Finish{' '}
					{unlockedBy}
				</span>
			</span>
			<span className={`${styles.previews} ${styles.lockedPreviews}`}>
				{difficultySections(set).map(section => (
					<span key={section.difficulty} className={styles.preview}>
						<span
							className={styles.previewImage}
							aria-hidden="true"
						>
							<PuzzleImage item={section.puzzles[0].item} />
						</span>
						{section.puzzles[0].item.palette.name}
					</span>
				))}
			</span>
		</button>
	)
}

export default function PuzzleSetList({
	sets,
	locked = [],
	solved,
	onChoose,
}: {
	readonly sets: readonly PlayerPuzzleSet[]
	readonly locked?: readonly Locked<PlayerPuzzleSet>[]
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
									<TrackLabel set={set} />
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
				{locked.length > 0 && (
					<li className={styles.lockedHeading}>
						Keep solving to unlock
					</li>
				)}
				{locked.map(entry => (
					<li key={entry.item.id}>
						<LockedSetButton {...entry} />
					</li>
				))}
			</ul>
		</>
	)
}
