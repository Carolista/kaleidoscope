import { useState } from 'react'
import { usePlayerContent } from '@/ui/content'
import PuzzleGrid from './PuzzleGrid'
import PuzzleSession from './PuzzleSession'
import PuzzleSetList from './PuzzleSetList'
import { usePuzzleSwipe } from './usePuzzleSwipe'
import { loadSolvedPuzzles, saveSolvedPuzzles } from './puzzleProgress'
import styles from './PuzzleMode.module.css'

export default function PuzzleMode({
	hidden = false,
}: {
	readonly hidden?: boolean
}) {
	const { puzzleSets } = usePlayerContent()
	const [solved, setSolved] = useState(loadSolvedPuzzles)
	const [setId, setSetId] = useState<string | null>(null)
	const [puzzleId, setPuzzleId] = useState<string | null>(null)
	const set = puzzleSets.find(item => item.id === setId)
	const item = set?.puzzles.find(puzzle => puzzle.id === puzzleId)
	const { stageRef, contentRef } = usePuzzleSwipe(item?.id ?? null)

	function markSolved(id: string) {
		setSolved(previous => {
			if (previous.has(id)) return previous
			const next = new Set(previous).add(id)
			saveSolvedPuzzles(next)
			return next
		})
	}

	if (set && item)
		return (
			<div ref={stageRef} hidden={hidden} className={styles.stage}>
				<PuzzleSession
					key={item.id}
					set={set}
					item={item}
					solved={solved}
					hidden={hidden}
					contentRef={contentRef}
					onSolved={markSolved}
					onChoose={setPuzzleId}
					onBack={() => setPuzzleId(null)}
				/>
			</div>
		)
	return (
		<section
			hidden={hidden}
			className={styles.browser}
			aria-label="Puzzle Mode"
		>
			{set ? (
				<PuzzleGrid
					set={set}
					solved={solved}
					onChoose={setPuzzleId}
					onBack={() => setSetId(null)}
				/>
			) : (
				<PuzzleSetList
					sets={puzzleSets}
					solved={solved}
					onChoose={setSetId}
				/>
			)}
		</section>
	)
}
