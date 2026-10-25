import {
	placePuzzlePiece,
	type Puzzle,
	type PuzzlePlacements,
} from '@/domain/puzzles'

// What a player has done so far in one unfinished puzzle. Only the pieces' positions and
// turns are kept, never the puzzle itself, so it is rebuilt from the published definition.
export interface PuzzleAttempt {
	readonly setId: string
	readonly placements: PuzzlePlacements
	readonly rotations: Readonly<Record<string, number>>
}

export interface ResumeState {
	// The unfinished puzzle played most recently.
	readonly current: string | null
	readonly attempts: Readonly<Record<string, PuzzleAttempt>>
}

export const EMPTY_RESUME: ResumeState = { current: null, attempts: {} }

const STORAGE_VERSION = 1

// Per device, and per player so that signing in or out never shows someone else's attempts.
export const resumeKey = (userId: string | null) =>
	`kaleidoscope:puzzle-resume:${userId ?? 'guest'}`

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPlacements(value: unknown): PuzzlePlacements {
	if (!isRecord(value)) return {}
	return Object.fromEntries(
		Object.entries(value).flatMap(([id, placement]) =>
			isRecord(placement) &&
			typeof placement.q === 'number' &&
			typeof placement.r === 'number'
				? [
						[
							id,
							{
								q: placement.q,
								r: placement.r,
								...(typeof placement.rotation === 'number'
									? { rotation: placement.rotation }
									: {}),
							},
						],
					]
				: [],
		),
	)
}

function readRotations(value: unknown): Record<string, number> {
	if (!isRecord(value)) return {}
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, number] => typeof entry[1] === 'number',
		),
	)
}

export function loadResume(userId: string | null): ResumeState {
	try {
		const raw = localStorage.getItem(resumeKey(userId))
		if (!raw) return EMPTY_RESUME
		const parsed: unknown = JSON.parse(raw)
		if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION)
			return EMPTY_RESUME
		const attempts = isRecord(parsed.attempts)
			? Object.fromEntries(
					Object.entries(parsed.attempts).flatMap(([id, attempt]) =>
						isRecord(attempt) &&
						typeof attempt.setId === 'string' &&
						attempt.setId !== ''
							? [
									[
										id,
										{
											setId: attempt.setId,
											placements: readPlacements(
												attempt.placements,
											),
											rotations: readRotations(
												attempt.rotations,
											),
										},
									],
								]
							: [],
					),
				)
			: {}
		return {
			current:
				typeof parsed.current === 'string' && parsed.current in attempts
					? parsed.current
					: null,
			attempts,
		}
	} catch {
		return EMPTY_RESUME
	}
}

export function saveResume(userId: string | null, state: ResumeState): void {
	try {
		localStorage.setItem(
			resumeKey(userId),
			JSON.stringify({ version: STORAGE_VERSION, ...state }),
		)
	} catch {
		// Losing a half-finished puzzle is not worth a crash.
	}
}

export function hasProgress(
	attempt: Pick<PuzzleAttempt, 'placements' | 'rotations'>,
) {
	return (
		Object.keys(attempt.placements).length > 0 ||
		Object.values(attempt.rotations).some(turns => turns !== 0)
	)
}

// Replays the stored placements against the puzzle as published now, dropping any that no
// longer fit, so a corrected puzzle or a damaged save never produces an impossible board.
// Null when nothing usable is left.
export function restoreAttempt(
	puzzle: Puzzle,
	stored: PuzzleAttempt,
): PuzzleAttempt | null {
	const pieceIds = new Set(puzzle.pieces.map(piece => piece.id))
	let placements: PuzzlePlacements = {}
	for (const [id, placement] of Object.entries(stored.placements)) {
		const result = placePuzzlePiece(puzzle, placements, id, placement)
		if (result.ok) placements = result.placements
	}
	const rotations = Object.fromEntries(
		Object.entries(stored.rotations).filter(
			([id, turns]) =>
				pieceIds.has(id) &&
				puzzle.rotationAllowed &&
				Number.isInteger(turns) &&
				turns > 0 &&
				turns < 6,
		),
	)
	const attempt = { setId: stored.setId, placements, rotations }
	return hasProgress(attempt) ? attempt : null
}
