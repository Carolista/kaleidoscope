import { useMemo } from 'react'
import type { PointerEvent, Ref } from 'react'
import type { AxialCoord } from '@/domain/shapes/hexagon'
import { pointsToSvgAttr, polygonBoundingBox } from '@/domain/geometry'
import {
	coordinateKey,
	pieceCells,
	puzzleShapes,
	rotateCoordinate,
} from '@/domain/puzzles'
import type {
	PuzzlePiece,
	PuzzlePlacements,
	PuzzleShapeId,
} from '@/domain/puzzles'
import styles from './PuzzleBoard.module.css'

// SVG units per tile edge: a hexagon's circumradius, or a triangle's side.
const tileSizes: Readonly<Record<PuzzleShapeId, number>> = {
	hexagon: 16,
	triangle: 28,
}

function cornersFor(shape: PuzzleShapeId, cell: AxialCoord) {
	return puzzleShapes[shape].corners(cell, tileSizes[shape])
}

function polygonPoints(shape: PuzzleShapeId, cell: AxialCoord): string {
	return pointsToSvgAttr(cornersFor(shape, cell))
}

function viewBoxFor(
	shape: PuzzleShapeId,
	cells: readonly AxialCoord[],
): string {
	const { minX, minY, maxX, maxY } = polygonBoundingBox(
		cells.map(cell => cornersFor(shape, cell)),
	)
	const padding = 3
	return `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`
}

function pieceOutline(
	shape: PuzzleShapeId,
	tiles: readonly AxialCoord[],
): string {
	const edges = new Map<string, string>()
	for (const tile of tiles) {
		const corners = cornersFor(shape, tile)
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
	shape,
	piece,
	drag,
}: {
	readonly shape: PuzzleShapeId
	readonly piece: PuzzlePiece
	readonly drag?: {
		readonly x: number
		readonly y: number
		readonly offset: AxialCoord
		readonly scale: number
	}
}) {
	const grabbed = drag
		? puzzleShapes[shape].center(drag.offset, tileSizes[shape])
		: null
	const [minX, minY, width, height] = viewBoxFor(shape, piece.tiles)
		.split(' ')
		.map(Number)
	// Reserve the largest rotated bounds so tray slots and tile scale stay fixed.
	const side = Math.ceil(
		Math.max(
			...Array.from({ length: 6 }, (_, rotation) => {
				const bounds = viewBoxFor(
					shape,
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
					points={polygonPoints(shape, tile)}
					fill={tile.color}
					data-piece-tile={index}
					className={styles.pieceTile}
				/>
			))}
		</svg>
	)
}

interface PuzzleBoardProps {
	readonly label?: string
	readonly shape: PuzzleShapeId
	readonly gridSize: number
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

export default function PuzzleBoard({
	label,
	shape,
	gridSize,
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
}: PuzzleBoardProps) {
	const cells = useMemo(
		() => puzzleShapes[shape].cells(gridSize),
		[shape, gridSize],
	)
	const wedge = cells.filter(cell => cell.isClickable)
	// Colors are keyed by wedge coordinates; mirrored cells follow their group.
	const wedgeKeys = new Map(
		wedge.map(cell => [cell.groupId, coordinateKey(cell)]),
	)
	const placedPieces = pieces.flatMap((piece, index) => {
		const anchor = placements[piece.id]
		if (!anchor) return []
		const tiles = pieceCells(piece, anchor)
		return [
			{
				piece,
				number: index + 1,
				tiles,
				outline: pieceOutline(shape, tiles),
			},
		]
	})
	return (
		<svg
			ref={svgRef}
			viewBox={viewBoxFor(shape, cells)}
			className={styles.gridGraphic}
			role={target ? 'img' : 'group'}
			aria-label={label ?? (target ? 'Target design' : 'Puzzle board')}
		>
			{cells.map(cell => {
				const interactive = cell.isClickable && !target && !solved
				const tileNumber = wedge.indexOf(cell) + 1
				const fill = colors[wedgeKeys.get(cell.groupId) ?? '']
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
						points={polygonPoints(shape, cell)}
						fill={fill ?? 'var(--base)'}
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
								? `Puzzle tile ${tileNumber} of ${wedge.length}, ${fill ? 'occupied' : 'empty'}`
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
