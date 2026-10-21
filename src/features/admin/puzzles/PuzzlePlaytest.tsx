import { useRef, type ReactNode } from 'react'
import { faRotate } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { IconButton } from '@/ui/components'
import type { Puzzle } from '@/domain/puzzles'
import { PuzzlePlay, type PuzzlePlayHandle } from '@/ui/puzzle'
import styles from './PuzzlePlaytest.module.css'

export default function PuzzlePlaytest({
	puzzle,
	actions,
	children,
}: {
	readonly puzzle: Puzzle
	// Extra buttons shown with Restart.
	readonly actions?: ReactNode
	// Rendered above the playtest, e.g. a save status.
	readonly children?: ReactNode
}) {
	const play = useRef<PuzzlePlayHandle>(null)
	return (
		<div className={styles.playtest}>
			{children}
			<PuzzlePlay
				ref={play}
				puzzle={puzzle}
				solvedMessage="Playtest solved! No player progress recorded."
				trayAction={
					<div className={styles.actions}>
						<IconButton
							size="sm"
							icon={faRotate}
							label="Restart"
							onClick={() => play.current?.reset()}
						/>
						{actions}
					</div>
				}
			/>
		</div>
	)
}
