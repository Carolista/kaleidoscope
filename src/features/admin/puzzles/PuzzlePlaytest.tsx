import { useRef, type ReactNode } from 'react'
import { faRotate } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { IconButton } from '@/ui/components'
import type { Puzzle } from '@/domain/puzzles'
import { PuzzlePlay, type PuzzlePlayHandle } from '@/ui/puzzle'
import styles from './PuzzlePlaytest.module.css'

export default function PuzzlePlaytest({
	puzzle,
	actions,
	layout,
	children,
}: {
	readonly puzzle: Puzzle
	// Extra buttons shown with Restart.
	readonly actions?: ReactNode
	// 'stage' packs the target and pieces around the board.
	readonly layout?: 'tray' | 'stage'
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
				layout={layout}
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
