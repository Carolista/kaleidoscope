import { Button, PlayerIconButton } from '@/ui/components'
import type { PlayerPuzzle, PlayerPuzzleSet } from '@/ui/content'
import { PuzzlePlay, type PuzzlePlayHandle } from '@/ui/puzzle'
import { DuotoneTintColorContext } from '@/ui/theme'
import {
	faArrowLeft,
	faRotate,
} from '@fortawesome/sharp-duotone-solid-svg-icons'
import { useRef, useState } from 'react'
import styles from './PuzzleMode.module.css'
import { nextUnsolvedPuzzle } from './setProgress'

export default function PuzzleSession({
	set,
	item,
	solved,
	hidden,
	onSolved,
	onChoose,
	onBack,
}: {
	readonly set: PlayerPuzzleSet
	readonly item: PlayerPuzzle
	readonly solved: ReadonlySet<string>
	readonly hidden: boolean
	readonly onSolved: (puzzleId: string) => void
	readonly onChoose: (puzzleId: string) => void
	readonly onBack: () => void
}) {
	const [justSolved, setJustSolved] = useState(false)
	const [advancing, setAdvancing] = useState(false)
	const play = useRef<PuzzlePlayHandle>(null)
	// The puzzle just solved already counts, so "next" skips it.
	const found = nextUnsolvedPuzzle(
		set,
		item.id,
		justSolved ? new Set([...solved, item.id]) : solved,
	)
	// Wrapping back to this same puzzle means there is no next one, before or after solving.
	const next = found?.id === item.id ? null : found

	return (
		<PuzzlePlay
			ref={play}
			puzzle={item.puzzle}
			hidden={hidden}
			solvedMessage="Puzzle solved! Your design matches the target."
			celebration="Congrats!"
			onSolve={() => {
				setJustSolved(true)
				onSolved(item.id)
			}}
		>
			<DuotoneTintColorContext.Provider value={item.palette.colors[1]}>
				<div className={styles.actions}>
					<PlayerIconButton
						icon={faArrowLeft}
						label="Back to puzzle set"
						onClick={onBack}
					/>
					{next && (
						// Always present so the icons beside it never shift.
						<Button
							disabled={!justSolved || advancing}
							onClick={() => {
								setAdvancing(true)
								onChoose(next.id)
							}}
						>
							Next puzzle
						</Button>
					)}
					<PlayerIconButton
						icon={faRotate}
						label="Restart"
						onClick={() => {
							setJustSolved(false)
							setAdvancing(false)
							play.current?.reset()
						}}
					/>
				</div>
			</DuotoneTintColorContext.Provider>
		</PuzzlePlay>
	)
}
