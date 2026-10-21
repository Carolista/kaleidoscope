import type { PuzzleShapeId } from '@/domain/puzzles'
import {
	purposeHasShape,
	type PuzzleGroupTrack,
} from '@/features/admin/services'

export interface GroupDetailsValue<Purpose extends string> {
	readonly purpose: Purpose
	// Kept while a daily purpose hides it, so switching back restores the choice.
	readonly shape: PuzzleShapeId
	readonly track: PuzzleGroupTrack | null
}

export function sameGroupDetails<Purpose extends string>(
	a: GroupDetailsValue<Purpose>,
	b: GroupDetailsValue<Purpose>,
	puzzleDetails: boolean,
): boolean {
	if (a.purpose !== b.purpose) return false
	if (!puzzleDetails) return true
	return (
		a.track === b.track &&
		(!purposeHasShape(a.purpose) || a.shape === b.shape)
	)
}
