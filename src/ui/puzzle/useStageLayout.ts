import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
	packPuzzleStage,
	puzzlePieceRadii,
	puzzleStageBoard,
	type Puzzle,
	type StageLayout,
} from '@/domain/puzzles'
import { tileSizes } from './tileSizes'

// At this width the stage lays out sideways (target left, pieces right and in
// the corners) and fits the screen's height; narrower, it grows upward.
const LANDSCAPE_MIN_WIDTH = 760
const LANDSCAPE_MIN_HEIGHT = 420
const LANDSCAPE_MAX_HEIGHT = 720
// Room kept for the page around the stage when fitting its height, unless the
// caller says its page needs more.
export const DEFAULT_PAGE_ROOM = 200
const RESIZE_DELAY_MS = 120
// A stage starts packing this far before it scrolls into view.
const NEAR_SCREEN = '600px'
// Until a stage has been packed, it holds about this much height per pixel of width.
const GUESSED_HEIGHT_PER_WIDTH = 1.4
const CACHE_LIMIT = 60

interface Measure {
	readonly width: number
	readonly viewportHeight: number
}

// Packing is the costly part, so results outlive the component: showing the
// same puzzle again, or a puzzle at a size seen before, costs nothing.
const layoutCache = new Map<string, StageLayout | null>()
// The tallest stage seen for each shape, mode, and width, so a new puzzle does
// not shrink the space and make the page jump while it is being packed.
const reservedHeights = new Map<string, number>()
// The last width measured, so a new stage can start from it.
let lastMeasure: Measure = { width: 0, viewportHeight: 0 }
// Whether anything has ever had room to measure. Where nothing does (no layout
// engine, as in tests), the usual layout is kept rather than waiting forever.
let hasMeasuredRoom = false

function remember(key: string, layout: StageLayout | null) {
	layoutCache.delete(key)
	layoutCache.set(key, layout)
	if (layoutCache.size > CACHE_LIMIT) {
		const oldest = layoutCache.keys().next().value
		if (oldest !== undefined) layoutCache.delete(oldest)
	}
}

// Measures the element it is given and packs the puzzle's target, tray pieces,
// and board into it, after the page has painted and once it is near the
// screen. `status` is 'pending' until packed, and 'failed' when nothing fits,
// so callers can keep their usual layout. `height` is the room to hold in the
// meantime and afterwards.
export function useStageLayout(
	puzzle: Puzzle,
	enabled: boolean,
	pageRoom = DEFAULT_PAGE_ROOM,
) {
	const element = useRef<HTMLDivElement>(null)
	const [measure, setMeasure] = useState<Measure>(lastMeasure)
	const [measured, setMeasured] = useState(false)
	const [near, setNear] = useState(
		() => typeof IntersectionObserver === 'undefined',
	)
	const [, packed] = useState(0)

	// Before paint, so the first frame already knows whether there is room.
	useLayoutEffect(() => {
		const node = element.current
		if (!enabled || !node) return
		let timer: ReturnType<typeof setTimeout> | undefined
		const read = () => {
			const next = {
				width: Math.floor(node.clientWidth),
				viewportHeight: window.innerHeight,
			}
			lastMeasure = next
			if (next.width > 0) hasMeasuredRoom = true
			// Puzzle Mode is mounted hidden while the player is elsewhere; that is not
			// "nowhere to measure", so keep holding the stage's place until it is shown.
			if (!node.closest('[hidden]')) setMeasured(true)
			setMeasure(previous =>
				previous.width === next.width &&
				previous.viewportHeight === next.viewportHeight
					? previous
					: next,
			)
		}
		const readSoon = () => {
			clearTimeout(timer)
			timer = setTimeout(read, RESIZE_DELAY_MS)
		}
		read()
		const resizes =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(readSoon)
		resizes?.observe(node)
		window.addEventListener('resize', readSoon)
		const sightings =
			typeof IntersectionObserver === 'undefined'
				? null
				: new IntersectionObserver(
						entries => {
							if (entries.some(entry => entry.isIntersecting))
								setNear(true)
						},
						{ rootMargin: NEAR_SCREEN },
					)
		sightings?.observe(node)
		return () => {
			clearTimeout(timer)
			resizes?.disconnect()
			sightings?.disconnect()
			window.removeEventListener('resize', readSoon)
		}
	}, [enabled])

	const { width, viewportHeight } = measure
	const board = useMemo(
		() =>
			enabled ? puzzleStageBoard(puzzle, tileSizes[puzzle.shape]) : null,
		[enabled, puzzle],
	)
	const pieceRadii = useMemo(
		() =>
			enabled ? puzzlePieceRadii(puzzle, tileSizes[puzzle.shape]) : null,
		[enabled, puzzle],
	)
	const landscape = width >= LANDSCAPE_MIN_WIDTH
	const stageHeight = Math.min(
		LANDSCAPE_MAX_HEIGHT,
		Math.max(LANDSCAPE_MIN_HEIGHT, viewportHeight - pageRoom),
	)
	const key =
		enabled && board && pieceRadii && width > 0
			? [
					puzzle.shape,
					puzzle.gridSize,
					landscape ? `landscape:${stageHeight}` : 'portrait',
					width,
					pieceRadii.map(radius => radius.toFixed(2)).join(','),
				].join('|')
			: null
	const cached = key === null ? undefined : layoutCache.get(key)

	useEffect(() => {
		if (key === null || !board || !pieceRadii) return
		if (layoutCache.has(key) || !near) return
		// After paint, so the page stays responsive while it packs.
		const timer = setTimeout(() => {
			remember(
				key,
				landscape
					? packPuzzleStage({
							mode: 'landscape',
							board,
							pieceRadii,
							width,
							height: stageHeight,
						})
					: packPuzzleStage({
							mode: 'portrait',
							board,
							pieceRadii,
							width,
						}),
			)
			packed(count => count + 1)
		}, 0)
		return () => clearTimeout(timer)
	}, [key, near, board, pieceRadii, landscape, width, stageHeight])

	const layout = cached ?? null
	// Nowhere to measure (and never anywhere): keep the usual layout.
	const noRoom = enabled && measured && width === 0 && !hasMeasuredRoom
	const status: 'pending' | 'ready' | 'failed' = noRoom
		? 'failed'
		: cached === undefined
			? 'pending'
			: cached === null
				? 'failed'
				: 'ready'

	const reserveKey = `${puzzle.shape}|${landscape ? 'landscape' : 'portrait'}|${width}`
	if (layout)
		reservedHeights.set(
			reserveKey,
			Math.max(reservedHeights.get(reserveKey) ?? 0, layout.height),
		)
	const height =
		reservedHeights.get(reserveKey) ??
		(landscape ? stageHeight : width * GUESSED_HEIGHT_PER_WIDTH)

	return { element, layout, status, height }
}
