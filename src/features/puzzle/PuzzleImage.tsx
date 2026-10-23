import { PuzzleBoard } from '@/ui/puzzle'
import type { PlayerPuzzle } from '@/ui/content'

// The solved design, with no grid lines, as a picture of the puzzle.
export default function PuzzleImage({ item }: { readonly item: PlayerPuzzle }) {
	return (
		<PuzzleBoard
			target
			shape={item.puzzle.shape}
			gridSize={item.puzzle.gridSize}
			colors={item.puzzle.target}
		/>
	)
}
