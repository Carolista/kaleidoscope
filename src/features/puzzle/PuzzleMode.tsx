import { useId, useRef, useState } from 'react'
import { faRotate } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { DarkModeToggle } from '@/components/controls'
import { Button, Modal, PlayerIconButton } from '@/components/shared'
import { colorSchemes } from '@/data/colorSchemes'
import { createPuzzleSeed, generateHexPuzzle } from '@/domain/puzzles'
import { PuzzlePlay, type PuzzlePlayHandle } from '@/ui/puzzle'
import styles from './PuzzleMode.module.css'

function createPuzzle(seed = createPuzzleSeed()) {
	return generateHexPuzzle(seed, colorSchemes[1])
}

export default function PuzzleMode({
	hidden = false,
	initialSeed,
}: {
	readonly hidden?: boolean
	readonly initialSeed?: string
}) {
	const [puzzle, setPuzzle] = useState(() => createPuzzle(initialSeed))
	const [solved, setSolved] = useState(false)
	const [showCongrats, setShowCongrats] = useState(false)
	const congratsTitleId = useId()
	const play = useRef<PuzzlePlayHandle>(null)

	function restart(newPuzzle: boolean) {
		setShowCongrats(false)
		setSolved(false)
		if (newPuzzle) setPuzzle(createPuzzle())
		play.current?.reset()
	}

	return (
		<PuzzlePlay
			ref={play}
			puzzle={puzzle}
			hidden={hidden}
			solvedMessage="Puzzle solved! Your design matches the target."
			onSolve={() => {
				setSolved(true)
				setShowCongrats(true)
			}}
		>
			<div className={styles.actions}>
				<DarkModeToggle />
				{solved && (
					<Button onClick={() => restart(true)}>Next puzzle</Button>
				)}
				<PlayerIconButton
					icon={faRotate}
					label="Restart"
					onClick={() => restart(false)}
				/>
			</div>
			<Modal
				open={showCongrats && !hidden}
				onClose={() => setShowCongrats(false)}
				labelledBy={congratsTitleId}
				size="sm"
				closeLabel="Close congratulations"
				header={<h2 id={congratsTitleId}>Congrats!</h2>}
			>
				<Button onClick={() => restart(true)}>Next Puzzle</Button>
			</Modal>
		</PuzzlePlay>
	)
}
