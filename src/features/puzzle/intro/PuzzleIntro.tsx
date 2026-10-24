import { useMemo, useState } from 'react'
import type { Palette } from '@/domain/palettes'
import { generatePuzzle, PUZZLE_RECIPES } from '@/domain/puzzles'
import { Button } from '@/ui/components'
import { PuzzlePlay } from '@/ui/puzzle'
import type { IntroTrack } from '@/features/puzzle/introProgress'
import styles from './PuzzleIntro.module.css'

// With this seed the small hexagon has three pieces of 3, 2, and 1 tiles and five
// colors; in the rotation version both larger pieces need turning.
const INTRO_SEED = 'intro-3'
const RECIPES = { basic: PUZZLE_RECIPES[0], rotation: PUZZLE_RECIPES[1] }
const PIECE_COUNT = 3

interface PuzzleIntroProps {
	readonly track: IntroTrack
	readonly palette: Palette
	readonly onContinue: () => void
}

function guidance(track: IntroTrack, placed: number, hasRotated: boolean) {
	if (placed === PIECE_COUNT)
		return track === 'rotation'
			? "Every piece is down, but the colors don't match yet. Send a piece back to the tray to turn it again."
			: "Every piece is down, but the colors don't match yet. Swap pieces around until they match the picture."
	if (placed > 0)
		return track === 'rotation'
			? 'Nice! Keep turning and placing. To turn a piece again, double-tap it on the board to send it back to the tray.'
			: 'Nice! Keep going. Changed your mind? Double-tap a piece on the board to send it back to the tray.'
	if (track === 'rotation')
		return hasRotated
			? 'Keep tapping until the colors line up with the picture, then drag the piece onto the board.'
			: 'These pieces can turn! Tap a piece in the tray to rotate it.'
	return 'Match the picture at the top. Drag each piece onto the board, or tap a piece and then a tile.'
}

function PuzzleIntro({ track, palette, onContinue }: PuzzleIntroProps) {
	const puzzle = useMemo(
		() => generatePuzzle(INTRO_SEED, palette, RECIPES[track], 'hexagon'),
		[palette, track],
	)
	const [solved, setSolved] = useState(false)
	const [placed, setPlaced] = useState(0)
	const [hasRotated, setHasRotated] = useState(false)
	const subject = track === 'rotation' ? 'rotation puzzle' : 'puzzle'

	return (
		<section
			className={styles.intro}
			aria-labelledby={
				solved ? 'puzzle-intro-congrats' : 'puzzle-intro-welcome'
			}
		>
			{solved ? (
				<>
					<h2
						id="puzzle-intro-congrats"
						className={styles.exclamation}
					>
						Congratulations!
					</h2>
					<p className={styles.message}>
						You've solved your first {subject}.
					</p>
				</>
			) : (
				<>
					<h2
						id="puzzle-intro-welcome"
						className={styles.exclamation}
					>
						Welcome!
					</h2>
					<p className={styles.message}>
						{track === 'rotation'
							? "Let's try a puzzle with turning pieces."
							: "Let's solve a puzzle."}
					</p>
				</>
			)}
			<PuzzlePlay
				puzzle={puzzle}
				solvedMessage="Puzzle solved! Your design matches the target."
				onSolve={() => setSolved(true)}
				onProgress={progress => {
					setPlaced(progress.placed)
					if (progress.rotated) setHasRotated(true)
				}}
				aboveBoard={
					<div className={styles.guidance}>
						{solved ? (
							<Button onClick={onContinue}>Continue</Button>
						) : (
							<p
								className={styles.message}
								role="status"
								aria-live="polite"
							>
								{guidance(track, placed, hasRotated)}
							</p>
						)}
					</div>
				}
			/>
		</section>
	)
}

export default PuzzleIntro
