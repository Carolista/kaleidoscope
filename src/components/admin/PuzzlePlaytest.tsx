import { useRef } from 'react'
import { faRotate } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { IconButton } from '@/components/shared'
import type { HexPuzzle } from '@/domain/puzzles'
import { PuzzlePlay, type PuzzlePlayHandle } from '@/ui/puzzle'

export default function PuzzlePlaytest({
	puzzle,
}: {
	readonly puzzle: HexPuzzle
}) {
	const play = useRef<PuzzlePlayHandle>(null)
	return (
		<PuzzlePlay
			ref={play}
			puzzle={puzzle}
			solvedMessage="Playtest solved! No player progress recorded."
			trayAction={
				<IconButton
					size="sm"
					icon={faRotate}
					label="Restart"
					onClick={() => play.current?.reset()}
				/>
			}
		/>
	)
}
