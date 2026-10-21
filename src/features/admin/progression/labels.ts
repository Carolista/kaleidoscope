import { isPuzzleShapeId, PUZZLE_SHAPE_LABELS } from '@/domain/puzzles'

export function shapeName(shapeId: string): string {
	return isPuzzleShapeId(shapeId) ? PUZZLE_SHAPE_LABELS[shapeId] : shapeId
}
