import { useMemo } from 'react'
import type { PointerEvent, Ref } from 'react'
import { generateHexagonCells } from '@geometry/hexagonGrid'
import {
	axialToPixel,
	boundingBox,
	hexagonCorners,
} from '@geometry/hexagonLayout'
import type { AxialCoord } from '@appTypes/hexagon'
import { pointsToSvgAttr } from '@utils/svgPoints'
import {
	coordinateKey,
	pieceCells,
	rotateCoordinate,
} from '../../puzzles/hexPuzzle'
import type { PuzzlePiece, PuzzlePlacements } from '../../puzzles/hexPuzzle'
import styles from './PuzzleMode.module.css'

const layout = { orientation: 'flat', size: 16 } as const

function polygonPoints(cell: AxialCoord): string {
	return pointsToSvgAttr(hexagonCorners(axialToPixel(cell, layout), layout))
}

function viewBoxFor(cells: readonly AxialCoord[]): string {
	const { minX, minY, maxX, maxY } = boundingBox(
		cells.map(cell => axialToPixel(cell, layout)),
		layout,
	)
	const padding = 3
	return `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`
}

function pieceOutline(tiles: readonly AxialCoord[]): string {
	const edges = new Map<string, string>()
	for (const tile of tiles) {
		const corners = hexagonCorners(axialToPixel(tile, layout), layout)
		for (let i = 0; i < corners.length; i++) {
			const start = corners[i]
			const end = corners[(i + 1) % corners.length]
			// Shared edges cancel; rounded endpoints absorb trigonometric noise.
			const key = [start, end]
				.map(
					point =>
						`${Math.round(point.x * 1e5)},${Math.round(point.y * 1e5)}`,
				)
				.sort()
				.join(':')
			if (edges.has(key)) edges.delete(key)
			else edges.set(key, `M ${start.x} ${start.y} L ${end.x} ${end.y}`)
		}
	}
	return [...edges.values()].join(' ')
}

export function PieceGraphic({
	piece,
	drag,
}: {
	readonly piece: PuzzlePiece
	readonly drag?: {
		readonly x: number
		readonly y: number
		readonly offset: AxialCoord
		readonly scale: number
	}
}) {
	const grabbed = drag ? axialToPixel(drag.offset, layout) : null
	const [minX, minY, width, height] = viewBoxFor(piece.tiles)
		.split(' ')
		.map(Number)
	// Reserve the largest rotated bounds so tray slots and tile scale stay fixed.
	const side = Math.ceil(
		Math.max(
			...Array.from({ length: 6 }, (_, rotation) => {
				const bounds = viewBoxFor(
					piece.tiles.map(tile => rotateCoordinate(tile, rotation)),
				)
					.split(' ')
					.map(Number)
				return Math.max(bounds[2], bounds[3])
			}),
		),
	)
	const viewBox = `${minX + width / 2 - side / 2} ${minY + height / 2 - side / 2} ${side} ${side}`
	return (
		<svg
			viewBox={
				grabbed ? `${grabbed.x - 0.5} ${grabbed.y - 0.5} 1 1` : viewBox
			}
			className={drag ? styles.draggedPiece : undefined}
			style={
				drag
					? {
							left: drag.x - drag.scale / 2,
							top: drag.y - drag.scale / 2,
							width: drag.scale,
							height: drag.scale,
						}
					: { width: side, height: side }
			}
			aria-hidden="true"
		>
			{piece.tiles.map((tile, index) => (
				<polygon
					key={coordinateKey(tile)}
					points={polygonPoints(tile)}
					fill={tile.color}
					data-piece-tile={index}
					className={styles.pieceTile}
				/>
			))}
		</svg>
	)
}

interface HexPuzzleBoardProps {
	readonly label?: string
	readonly radius: number
	readonly colors: Readonly<Record<string, string>>
	readonly target?: boolean
	readonly solved?: boolean
	readonly pieces?: readonly PuzzlePiece[]
	readonly placements?: PuzzlePlacements
	readonly selectedId?: string | null
	readonly svgRef?: Ref<SVGSVGElement>
	readonly onActivate?: (cell: AxialCoord, keyboard: boolean) => void
	readonly onReturn?: (cell: AxialCoord) => void
	readonly onGrab?: (
		event: PointerEvent<SVGPolygonElement>,
		cell: AxialCoord,
	) => void
}

export default function HexPuzzleBoard({
	label,
	radius,
	colors,
	target = false,
	solved = false,
	pieces = [],
	placements = {},
	selectedId,
	svgRef,
	onActivate,
	onReturn,
	onGrab,
}: HexPuzzleBoardProps) {
	const cells = useMemo(() => generateHexagonCells(radius), [radius])
	const wedge = cells.filter(cell => cell.isClickable)
	const placedPieces = pieces.flatMap((piece, index) => {
		const anchor = placements[piece.id]
		if (!anchor) return []
		const tiles = pieceCells(piece, anchor)
		return [
			{ piece, number: index + 1, tiles, outline: pieceOutline(tiles) },
		]
	})
	return (
		<svg
			ref={svgRef}
			viewBox={viewBoxFor(cells)}
			className={styles.gridGraphic}
			role={target ? 'img' : 'group'}
			aria-label={label ?? (target ? 'Target design' : 'Puzzle board')}
		>
			{cells.map(cell => {
				const interactive = cell.isClickable && !target && !solved
				const tileNumber = wedge.indexOf(cell) + 1
				const placedPiece = interactive
					? placedPieces.find(({ tiles }) =>
							tiles.some(
								tile =>
									coordinateKey(tile) === coordinateKey(cell),
							),
						)
					: undefined
				return (
					<polygon
						key={coordinateKey(cell)}
						points={polygonPoints(cell)}
						fill={colors[cell.groupId] ?? 'var(--base)'}
						className={
							target || solved
								? styles.targetCell
								: interactive
									? styles.wedgeCell
									: `${styles.mirrorCell}${solved ? '' : ` ${styles.mutedMirrorCell}`}`
						}
						data-puzzle-cell={
							interactive ? coordinateKey(cell) : undefined
						}
						role={interactive ? 'button' : undefined}
						tabIndex={interactive ? 0 : undefined}
						aria-label={
							interactive
								? `Puzzle tile ${tileNumber} of ${wedge.length}, ${colors[cell.groupId] ? 'occupied' : 'empty'}`
								: undefined
						}
						aria-hidden={interactive || target ? undefined : true}
						aria-description={
							placedPiece
								? `Piece ${placedPiece.number}. Double-click or double-tap to return to tray; keyboard: Delete or Backspace.`
								: undefined
						}
						aria-pressed={
							placedPiece
								? placedPiece.piece.id === selectedId
								: undefined
						}
						onPointerDown={
							interactive
								? event => onGrab?.(event, cell)
								: undefined
						}
						onClick={
							interactive
								? () => onActivate?.(cell, false)
								: undefined
						}
						onDoubleClick={
							interactive ? () => onReturn?.(cell) : undefined
						}
						onKeyDown={
							interactive
								? event => {
										if (
											event.key === 'Enter' ||
											event.key === ' '
										) {
											event.preventDefault()
											onActivate?.(cell, true)
										} else if (
											event.key === 'Delete' ||
											event.key === 'Backspace'
										) {
											event.preventDefault()
											onReturn?.(cell)
										}
									}
								: undefined
						}
					/>
				)
			})}
			{!target &&
				!solved &&
				placedPieces.map(({ piece, outline }) => (
					<g
						key={piece.id}
						data-piece-outline={piece.id}
						className={
							piece.id === selectedId
								? styles.selectedOutline
								: styles.pieceOutline
						}
						aria-hidden="true"
					>
						<path d={outline} className={styles.outlineHalo} />
						<path d={outline} className={styles.outlineEdge} />
					</g>
				))}
		</svg>
	)
}
