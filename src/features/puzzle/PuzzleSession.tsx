import { Button, PlayerIconButton } from '@/ui/components'
import type { PlayerPuzzle, PlayerPuzzleSet } from '@/ui/content'
import { usePuzzleResume } from '@/ui/content'
import {
	PuzzlePlay,
	type PuzzlePlayHandle,
	useTargetGridToggle,
} from '@/ui/puzzle'
import { DuotoneTintColorContext } from '@/ui/theme'
import {
	faLeftFromBracket,
	faRotateReverse,
} from '@fortawesome/sharp-duotone-solid-svg-icons'
import type { Ref } from 'react'
import { useRef, useState } from 'react'
import { pickCelebration } from './celebration'
import styles from './PuzzleMode.module.css'
import { nextUnsolvedPuzzle } from './setProgress'

// Header, controls, and footer around the stage, which a wide screen's height must also hold.
const PAGE_ROOM = 350

export default function PuzzleSession({
	set,
	item,
	solved,
	hidden,
	contentRef,
	onSolved,
	onChoose,
	onBack,
}: {
	readonly set: PlayerPuzzleSet
	readonly item: PlayerPuzzle
	readonly solved: ReadonlySet<string>
	readonly hidden: boolean
	readonly contentRef: Ref<HTMLDivElement>
	readonly onSolved: (puzzleId: string) => void
	readonly onChoose: (puzzleId: string) => void
	readonly onBack: () => void
}) {
	const [justSolved, setJustSolved] = useState(false)
	const [advancing, setAdvancing] = useState(false)
	// Picked when solved rather than during render, so re-renders never change it.
	const [celebration, setCelebration] = useState('')
	const play = useRef<PuzzlePlayHandle>(null)
	const gridToggle = useTargetGridToggle()
	const resume = usePuzzleResume()
	// Read once: the board starts from what was left, and the session is rebuilt per puzzle.
	const [earlier] = useState(() => resume.attemptFor(item.id))
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
			initialState={earlier ?? undefined}
			onStateChange={state =>
				resume.save(item.id, { setId: set.id, ...state })
			}
			hidden={hidden}
			layout="stage"
			wide
			pageRoom={PAGE_ROOM}
			solvedMessage="Puzzle solved! Your design matches the target."
			contentRef={contentRef}
			celebration={celebration}
			onSolve={() => {
				resume.clear(item.id)
				setCelebration(pickCelebration())
				setJustSolved(true)
				onSolved(item.id)
			}}
		>
			<DuotoneTintColorContext.Provider value={item.palette.colors[1]}>
				<div className={styles.actions}>
					<PlayerIconButton
						icon={faLeftFromBracket}
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
					<PlayerIconButton {...gridToggle} />
					<PlayerIconButton
						icon={faRotateReverse}
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
