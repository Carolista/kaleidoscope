import { useState } from 'react'
import { findIntroPalette } from '@/domain/palettes'
import { usePlayerContent, usePlayerProgress } from '@/ui/content'
import type { NewRewards } from '@/ui/content'
import { PuzzleIntro } from './intro'
import { loadSeenIntros, needsIntro, saveSeenIntros } from './introProgress'
import type { IntroTrack } from './introProgress'
import PuzzleGrid from './PuzzleGrid'
import PuzzleSession from './PuzzleSession'
import PuzzleSetList from './PuzzleSetList'
import RewardModal from './RewardModal'
import { usePuzzleSwipe } from './usePuzzleSwipe'
import styles from './PuzzleMode.module.css'

export default function PuzzleMode({
	hidden = false,
	onOpenZen,
}: {
	readonly hidden?: boolean
	// Lets a reward announcement send the player to Zen Mode.
	readonly onOpenZen?: () => void
}) {
	const { palettes, puzzleSets } = usePlayerContent()
	const { solved, markSolved } = usePlayerProgress()
	const [seenIntros, setSeenIntros] = useState(loadSeenIntros)
	const [setId, setSetId] = useState<string | null>(null)
	const [puzzleId, setPuzzleId] = useState<string | null>(null)
	// Kept after closing until the dialog has finished animating out.
	const [rewards, setRewards] = useState<NewRewards | null>(null)
	const [rewardsOpen, setRewardsOpen] = useState(false)
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

	function solve(id: string) {
		const earned = markSolved(id)
		if (earned.palettes.length || earned.bonusSets.length) {
			setRewards(earned)
			setRewardsOpen(true)
		}
	}

	const rewardModal = rewards && (
		<RewardModal
			open={rewardsOpen}
			rewards={rewards}
			onClose={() => setRewardsOpen(false)}
			onAfterClose={() => setRewards(null)}
			onOpenZen={() => {
				setRewardsOpen(false)
				onOpenZen?.()
			}}
			onOpenSet={target => {
				setRewardsOpen(false)
				setSetId(target.id)
				setPuzzleId(null)
			}}
		/>
	)

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
			<>
				<div ref={stageRef} hidden={hidden} className={styles.stage}>
					<PuzzleSession
						key={item.id}
						set={set}
						item={item}
						solved={solved}
						hidden={hidden}
						contentRef={contentRef}
						onSolved={solve}
						onChoose={setPuzzleId}
						onBack={() => setPuzzleId(null)}
					/>
				</div>
				{rewardModal}
			</>
		)
	return (
		<>
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
			{rewardModal}
		</>
	)
}
