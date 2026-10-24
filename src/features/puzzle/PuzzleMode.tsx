import { useState } from 'react'
import { findIntroPalette } from '@/domain/palettes'
import { usePlayerContent } from '@/ui/content'
import { PuzzleIntro } from './intro'
import { loadSeenIntros, needsIntro, saveSeenIntros } from './introProgress'
import type { IntroTrack } from './introProgress'
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
	const { palettes, puzzleSets } = usePlayerContent()
	const [solved, setSolved] = useState(loadSolvedPuzzles)
	const [seenIntros, setSeenIntros] = useState(loadSeenIntros)
	const [setId, setSetId] = useState<string | null>(null)
	const [puzzleId, setPuzzleId] = useState<string | null>(null)
	const set = puzzleSets.find(item => item.id === setId)
	const item = set?.puzzles.find(puzzle => puzzle.id === puzzleId)
	const { stageRef, contentRef } = usePuzzleSwipe(item?.id ?? null)

	// The first Puzzle Mode visit teaches basic puzzles; the first rotation set teaches turning.
	const introTrack: IntroTrack | null =
		palettes.length === 0 || puzzleSets.length === 0
			? null
			: needsIntro('basic', seenIntros, puzzleSets, solved)
				? 'basic'
				: set?.track === 'rotation' &&
					  needsIntro('rotation', seenIntros, puzzleSets, solved)
					? 'rotation'
					: null

	function completeIntro(track: IntroTrack) {
		setSeenIntros(previous => {
			const next = new Set(previous).add(track)
			saveSeenIntros(next)
			return next
		})
	}

	function markSolved(id: string) {
		setSolved(previous => {
			if (previous.has(id)) return previous
			const next = new Set(previous).add(id)
			saveSolvedPuzzles(next)
			return next
		})
	}

	if (introTrack)
		return (
			<div hidden={hidden} className={styles.browser}>
				<PuzzleIntro
					key={introTrack}
					track={introTrack}
					palette={findIntroPalette(palettes, introTrack)}
					onContinue={() => completeIntro(introTrack)}
				/>
			</div>
		)
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
