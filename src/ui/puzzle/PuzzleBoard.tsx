import { useMemo } from 'react'
import type { CSSProperties, PointerEvent, Ref } from 'react'
import type { Point } from '@/domain/geometry'
import type { AxialCoord } from '@/domain/shapes/hexagon'
import {
	enclosingCircle,
	pointsToSvgAttr,
	polygonBoundingBox,
} from '@/domain/geometry'
import { brightenAndSaturate } from '@/domain/palettes'
import {
	coordinateKey,
	pieceCells,
	puzzleShapes,
	rotateCoordinate,
} from '@/domain/puzzles'
import type {
	PlacedCoord,
	PuzzlePiece,
	PuzzlePlacements,
	PuzzleShapeId,
} from '@/domain/puzzles'
import styles from './PuzzleBoard.module.css'
import { tileSizes } from './tileSizes'

// Board units around a held piece kept for its shadow and lift.
const HELD_SHADOW_ROOM = 16

function cornersFor(shape: PuzzleShapeId, cell: PlacedCoord) {
	return puzzleShapes[shape].corners(cell, tileSizes[shape])
}

// Where a piece's tiles sit when they are not on the board.
function pieceCornersFor(shape: PuzzleShapeId, tile: AxialCoord) {
	const { corners, pieceCorners } = puzzleShapes[shape]
	return (pieceCorners ?? corners)(tile, tileSizes[shape])
}

function pieceCenterFor(shape: PuzzleShapeId, tile: AxialCoord) {
	const { center, pieceCenter } = puzzleShapes[shape]
	return (pieceCenter ?? center)(tile, tileSizes[shape])
}

function polygonPoints(shape: PuzzleShapeId, cell: PlacedCoord): string {
	return pointsToSvgAttr(cornersFor(shape, cell))
}

function viewBoxFor(
	shape: PuzzleShapeId,
	cells: readonly PlacedCoord[],
	cornersOf: (
		shape: PuzzleShapeId,
		cell: PlacedCoord,
	) => Point[] = cornersFor,
): string {
	const { minX, minY, maxX, maxY } = polygonBoundingBox(
		cells.map(cell => cornersOf(shape, cell)),
	)
	const padding = 3
	return `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`
}

// A square view box of `side` board units centered on the circle that just
// holds the piece, so the stage's circle for it holds the drawing too.
function stageViewBox(
	shape: PuzzleShapeId,
	tiles: readonly AxialCoord[],
	side: number,
): string {
	const { x, y } = enclosingCircle(
		tiles.flatMap(tile => pieceCornersFor(shape, tile)),
	)
	return `${x - side / 2} ${y - side / 2} ${side} ${side}`
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
	stage,
}: {
	readonly shape: PuzzleShapeId
	readonly piece: PuzzlePiece
	// Draws the piece centered in a circle of this pixel diameter, at this many
	// pixels per board unit, instead of in a square slot at one pixel per unit.
	readonly stage?: { readonly unit: number; readonly diameter: number }
	readonly drag?: {
		readonly x: number
		readonly y: number
		readonly offset: AxialCoord
		readonly scale: number
		// Draws the piece at its board position for this anchor, locked to the
		// board's screen transform, instead of following the pointer.
		readonly snap?: {
			readonly anchor: AxialCoord
			readonly board: Pick<DOMMatrix, 'a' | 'b' | 'c' | 'd' | 'e' | 'f'>
		}
	}
}) {
	const snap = drag?.snap
	const tiles = snap ? pieceCells(piece, snap.anchor) : piece.tiles
	const grabbedCell =
		drag && snap
			? {
					q: snap.anchor.q + drag.offset.q,
					r: snap.anchor.r + drag.offset.r,
				}
			: drag?.offset
	const grabbed = !grabbedCell
		? null
		: snap
			? puzzleShapes[shape].center(grabbedCell, tileSizes[shape])
			: pieceCenterFor(shape, grabbedCell)
	const screen =
		drag && snap && grabbed
			? {
					x:
						snap.board.a * grabbed.x +
						snap.board.c * grabbed.y +
						snap.board.e,
					y:
						snap.board.b * grabbed.x +
						snap.board.d * grabbed.y +
						snap.board.f,
				}
			: drag
				? { x: drag.x, y: drag.y }
				: null
	const [minX, minY, width, height] = viewBoxFor(
		shape,
		piece.tiles,
		pieceCornersFor,
	)
		.split(' ')
		.map(Number)
	// Reserve the largest rotated bounds so tray slots and tile scale stay fixed.
	const side = Math.ceil(
		Math.max(
			...Array.from(
				{ length: 6 / puzzleShapes[shape].rotationStep },
				(_, turn) => turn * puzzleShapes[shape].rotationStep,
			).map(rotation => {
				const bounds = viewBoxFor(
					shape,
					piece.tiles.map(tile => rotateCoordinate(tile, rotation)),
					pieceCornersFor,
				)
					.split(' ')
					.map(Number)
				return Math.max(bounds[2], bounds[3])
			}),
		),
	)
	const viewBox = stage
		? stageViewBox(shape, piece.tiles, stage.diameter / stage.unit)
		: `${minX + width / 2 - side / 2} ${minY + height / 2 - side / 2} ${side} ${side}`
	// A held piece's box is sized to hold the whole piece and its shadow, centered
	// on the grabbed tile. Relying on overflow outside a tiny box left the piece
	// invisible in iOS Safari once a filter was applied.
	const half =
		drag && grabbed
			? Math.max(
					...tiles.flatMap(tile =>
						(snap
							? cornersFor(shape, tile)
							: pieceCornersFor(shape, tile)
						).map(point =>
							Math.max(
								Math.abs(point.x - grabbed.x),
								Math.abs(point.y - grabbed.y),
							),
						),
					),
				) *
					1.1 +
				HELD_SHADOW_ROOM
			: 0
	return (
		<svg
			viewBox={
				grabbed
					? `${grabbed.x - half} ${grabbed.y - half} ${2 * half} ${2 * half}`
					: viewBox
			}
			className={
				drag
					? snap
						? styles.draggedPiece
						: `${styles.draggedPiece} ${styles.floatingPiece}`
					: undefined
			}
			style={
				drag && screen
					? ({
							left: screen.x - half * drag.scale,
							top: screen.y - half * drag.scale,
							width: 2 * half * drag.scale,
							height: 2 * half * drag.scale,
							// The shadow follows the board's scale: 4 tile units of lift.
							'--lift': `${drag.scale * 4}px`,
						} as CSSProperties)
					: stage
						? { width: stage.diameter, height: stage.diameter }
						: { width: side, height: side }
			}
			aria-hidden="true"
		>
			{tiles.map((tile, index) => (
				<polygon
					key={coordinateKey(tile)}
					points={
						snap
							? polygonPoints(shape, tile)
							: pointsToSvgAttr(pieceCornersFor(shape, tile))
					}
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
	// False drops the lines between cells, for small thumbnails.
	readonly gridlines?: boolean
	readonly solved?: boolean
	// Fades the graphic, like a tray piece that is already on the board.
	readonly dimmed?: boolean
	readonly pieces?: readonly PuzzlePiece[]
	readonly placements?: PuzzlePlacements
	readonly selectedId?: string | null
	readonly svgRef?: Ref<SVGSVGElement>
	// `keyboard` is true for keys and for assistive-technology clicks (click detail 0).
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
	gridlines = true,
	solved = false,
	dimmed = false,
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
			data-dimmed={dimmed || undefined}
			role={target ? 'img' : 'group'}
			data-puzzle-board={target ? undefined : ''}
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
						key={`${cell.transform ?? 0}:${coordinateKey(cell)}`}
						points={polygonPoints(shape, cell)}
						fill={fill ?? 'var(--accent)'}
						style={
							{
								...(gridlines
									? undefined
									: { stroke: fill ?? 'var(--accent)' }),
								...(interactive && {
									'--hover-fill': fill
										? brightenAndSaturate(fill)
										: undefined,
								}),
							} as CSSProperties
						}
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
								? event =>
										onActivate?.(cell, event.detail === 0)
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
				// SVG paints in document order, so the selected piece goes last to keep its
				// whole outline visible along edges it shares with neighbors.
				[...placedPieces]
					.sort(
						(a, b) =>
							Number(a.piece.id === selectedId) -
							Number(b.piece.id === selectedId),
					)
					.map(({ piece, outline }) => (
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
							{piece.id === selectedId && (
								<path
									d={outline}
									className={styles.outlineEdge}
								/>
							)}
						</g>
					))}
		</svg>
	)
}
