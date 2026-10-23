import { useId, useRef, useState } from 'react'
import {
	faArrowLeft,
	faRotate,
} from '@fortawesome/sharp-duotone-solid-svg-icons'
import { Button, Modal, PlayerIconButton } from '@/ui/components'
import type { PlayerPuzzle, PlayerPuzzleSet } from '@/ui/content'
import { PuzzlePlay, type PuzzlePlayHandle } from '@/ui/puzzle'
import { DuotoneTintColorContext } from '@/ui/theme'
import { nextUnsolvedPuzzle } from './setProgress'
import styles from './PuzzleMode.module.css'

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
	const [showCongrats, setShowCongrats] = useState(false)
	const congratsTitleId = useId()
	const play = useRef<PuzzlePlayHandle>(null)
	// The puzzle just solved already counts, so "next" skips it.
	const next = nextUnsolvedPuzzle(
		set,
		item.id,
		justSolved ? new Set([...solved, item.id]) : solved,
	)

	return (
		<PuzzlePlay
			ref={play}
			puzzle={item.puzzle}
			hidden={hidden}
			solvedMessage="Puzzle solved! Your design matches the target."
			onSolve={() => {
				setJustSolved(true)
				setShowCongrats(true)
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
					{justSolved && next && (
						<Button onClick={() => onChoose(next.id)}>
							Next puzzle
						</Button>
					)}
					<PlayerIconButton
						icon={faRotate}
						label="Restart"
						onClick={() => {
							setShowCongrats(false)
							setJustSolved(false)
							play.current?.reset()
						}}
					/>
				</div>
			</DuotoneTintColorContext.Provider>
			<Modal
				open={showCongrats && !hidden}
				onClose={() => setShowCongrats(false)}
				labelledBy={congratsTitleId}
				size="sm"
				closeLabel="Close congratulations"
				header={<h2 id={congratsTitleId}>Congrats!</h2>}
			>
				{next ? (
					<Button onClick={() => onChoose(next.id)}>
						Next Puzzle
					</Button>
				) : (
					<>
						<p>You solved every puzzle in {set.name}!</p>
						<Button onClick={onBack}>Choose another puzzle</Button>
					</>
				)}
			</Modal>
		</PuzzlePlay>
	)
}
