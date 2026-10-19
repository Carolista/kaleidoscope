import type { AxialCoord } from '@appTypes/hexagon'
import { DarkModeToggle } from '@controls'
import { colorSchemes } from '@data/colorSchemes'
import { faRotate } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { Button, IconButton, PlayerIconButton, Modal } from '@shared'
import type { PointerEvent } from 'react'
import { useId, useRef, useState } from 'react'
import type {
	HexPuzzle,
	PuzzlePiece,
	PuzzlePlacements,
} from '../../puzzles/hexPuzzle'
import {
	coordinateKey,
	generateHexPuzzle,
	getPuzzleColors,
	isPuzzleSolved,
	pieceCells,
	placePuzzlePiece,
	rotateCoordinate,
} from '../../puzzles/hexPuzzle'
import HexPuzzleBoard, { PieceGraphic } from './HexPuzzleBoard'
import styles from './PuzzleMode.module.css'
import { createPuzzleSeed } from '../../puzzles/puzzleSeed'

interface DragState {
	readonly piece: PuzzlePiece
	readonly pointerId: number
	readonly pointerType: string
	readonly offset: AxialCoord
	readonly startX: number
	readonly startY: number
	readonly x: number
	readonly y: number
	readonly scale: number
	readonly anchor: AxialCoord | null
	readonly moved: boolean
}

export default function PuzzleMode({
	hidden = false,
	initialSeed,
	previewPuzzle,
}: {
	readonly hidden?: boolean
	readonly initialSeed?: string
	readonly previewPuzzle?: HexPuzzle
}) {
	const [puzzle, setPuzzle] = useState(
		() =>
			previewPuzzle ??
			generateHexPuzzle(
				initialSeed ?? createPuzzleSeed(),
				colorSchemes[1],
			),
	)
	const [placements, setPlacements] = useState<PuzzlePlacements>({})
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [rotations, setRotations] = useState<
		Readonly<Record<string, number>>
	>({})
	const [showCongrats, setShowCongrats] = useState(false)
	const congratsTitleId = useId()
	const [message, setMessage] = useState('Choose a piece to get started.')
	const [drag, setDrag] = useState<DragState | null>(null)
	const dragRef = useRef<DragState | null>(null)
	const boardRef = useRef<SVGSVGElement>(null)
	const suppressClickRef = useRef(false)
	const lastTouchTapRef = useRef<{ pieceId: string; time: number } | null>(
		null,
	)
	const currentPuzzle = previewPuzzle ?? puzzle
	const displayPieces = currentPuzzle.pieces.map(piece => ({
		...piece,
		tiles: piece.tiles.map(tile =>
			rotateCoordinate(tile, rotations[piece.id] ?? 0),
		),
	}))
	const colors = getPuzzleColors(currentPuzzle, placements)
	const solved = isPuzzleSolved(currentPuzzle, placements)

	function selectPiece(id: string) {
		if (solved) return
		if (suppressClickRef.current) {
			suppressClickRef.current = false
			return
		}
		setSelectedId(id)
		setMessage(
			'Select a wedge tile to place this piece, or drag it into position.',
		)
	}

	function place(id: string, anchor: AxialCoord) {
		if (solved) return
		const result = placePuzzlePiece(currentPuzzle, placements, id, {
			...anchor,
			...(currentPuzzle.rotationAllowed
				? { rotation: rotations[id] ?? 0 }
				: {}),
		})
		if (!result.ok) {
			setSelectedId(id)
			setMessage(result.reason)
			return
		}
		setPlacements(result.placements)
		setSelectedId(null)
		setShowCongrats(
			!previewPuzzle && isPuzzleSolved(currentPuzzle, result.placements),
		)
		setMessage(
			Object.keys(result.placements).length ===
				currentPuzzle.pieces.length &&
				!isPuzzleSolved(currentPuzzle, result.placements)
				? 'All pieces fit, but the colors do not match yet. Try rearranging them.'
				: 'Piece placed. Choose another piece or move one already on the board.',
		)
	}

	function pieceAt(cell: AxialCoord) {
		return displayPieces.find(piece => {
			const anchor = placements[piece.id]
			return (
				anchor &&
				pieceCells(piece, { q: anchor.q, r: anchor.r }).some(
					tile => coordinateKey(tile) === coordinateKey(cell),
				)
			)
		})
	}

	function activateCell(cell: AxialCoord, keyboard: boolean) {
		if (solved) return
		if (suppressClickRef.current) {
			suppressClickRef.current = false
			return
		}
		const occupied = pieceAt(cell)
		if (
			selectedId &&
			occupied?.id !== selectedId &&
			(keyboard || !currentPuzzle.rotationAllowed)
		)
			place(selectedId, cell)
		else {
			if (occupied) selectPiece(occupied.id)
			else setMessage('Choose a piece from the tray first.')
		}
	}

	function startDrag(
		event: PointerEvent<HTMLElement | SVGPolygonElement>,
		piece: PuzzlePiece,
		offset: AxialCoord,
	) {
		if (
			solved ||
			event.button !== 0 ||
			(event.currentTarget instanceof HTMLButtonElement &&
				event.currentTarget.disabled) ||
			(dragRef.current && dragRef.current.pointerId !== event.pointerId)
		)
			return
		suppressClickRef.current = false
		const transform = boardRef.current?.getScreenCTM?.()
		const next: DragState = {
			piece,
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			offset,
			startX: event.clientX,
			startY: event.clientY,
			x: event.clientX,
			y: event.clientY,
			scale: transform ? Math.hypot(transform.a, transform.b) : 1,
			anchor: null,
			moved: false,
		}
		dragRef.current = next
		setDrag(next)
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	function pointerPosition(event: PointerEvent): DragState | null {
		const current = dragRef.current
		if (!current || event.pointerId !== current.pointerId) return null
		const element = document.elementFromPoint(event.clientX, event.clientY)
		const key = element
			?.closest('[data-puzzle-cell]')
			?.getAttribute('data-puzzle-cell')
		const coord = key ? key.split(',').map(Number) : null
		return {
			...current,
			x: event.clientX,
			y: event.clientY,
			moved:
				current.moved ||
				Math.hypot(
					event.clientX - current.startX,
					event.clientY - current.startY,
				) > 5,
			anchor: coord
				? {
						q: coord[0] - current.offset.q,
						r: coord[1] - current.offset.r,
					}
				: null,
		}
	}

	function endDrag(event: PointerEvent) {
		const current = pointerPosition(event)
		if (!current) return
		dragRef.current = null
		setDrag(null)
		if (!current.moved) {
			if (
				current.pointerType === 'touch' &&
				placements[current.piece.id]
			) {
				const previous = lastTouchTapRef.current
				if (
					previous?.pieceId === current.piece.id &&
					event.timeStamp - previous.time <= 350
				) {
					lastTouchTapRef.current = null
					suppressClickRef.current = true
					returnToTray(current.piece.id)
				} else {
					lastTouchTapRef.current = {
						pieceId: current.piece.id,
						time: event.timeStamp,
					}
				}
			} else {
				lastTouchTapRef.current = null
			}
			return
		}
		lastTouchTapRef.current = null
		suppressClickRef.current = true
		if (current.anchor) {
			place(current.piece.id, current.anchor)
		} else if (
			document
				.elementFromPoint(event.clientX, event.clientY)
				?.closest('[data-puzzle-tray]')
		) {
			returnToTray(current.piece.id)
		} else {
			setSelectedId(current.piece.id)
			setMessage(
				'Drop onto a wedge tile, or return the piece to the tray.',
			)
		}
	}

	function returnToTray(id: string) {
		if (solved) return
		const next = { ...placements }
		delete next[id]
		setPlacements(next)
		setSelectedId(null)
		lastTouchTapRef.current = null
		setMessage('Piece returned to the tray.')
	}

	function activateTrayPiece(id: string) {
		if (solved || placements[id]) return
		if (suppressClickRef.current) {
			suppressClickRef.current = false
			return
		}
		lastTouchTapRef.current = null
		selectPiece(id)
		if (currentPuzzle.rotationAllowed) {
			setRotations(previous => ({
				...previous,
				[id]: ((previous[id] ?? 0) + 1) % 6,
			}))
			setMessage(
				'Piece rotated 60 degrees. Drag it onto the board, or use keyboard placement.',
			)
		}
	}

	function reset(newPuzzle: boolean) {
		setShowCongrats(false)
		if (newPuzzle) {
			setPuzzle(generateHexPuzzle(createPuzzleSeed(), colorSchemes[1]))
		}
		setPlacements({})
		setRotations({})
		setSelectedId(null)
		dragRef.current = null
		setDrag(null)
		suppressClickRef.current = false
		lastTouchTapRef.current = null
		setMessage('Choose a piece to get started.')
	}

	return (
		<section
			hidden={hidden}
			className={`${styles.puzzle}${previewPuzzle ? ` ${styles.preview}` : ''}`}
			aria-label="Puzzle Mode"
			onPointerDownCapture={() => {
				suppressClickRef.current = false
			}}
			onKeyDownCapture={() => {
				suppressClickRef.current = false
			}}
			onPointerMove={event => {
				const next = pointerPosition(event)
				if (!next) return
				dragRef.current = next
				setDrag(next)
			}}
			onPointerUp={endDrag}
			onPointerCancel={event => {
				if (dragRef.current?.pointerId !== event.pointerId) return
				dragRef.current = null
				setDrag(null)
				lastTouchTapRef.current = null
				suppressClickRef.current = true
				setMessage('Drag cancelled. Your piece has not moved.')
			}}
		>
			<div className={styles.goalAndPieces}>
				<figure className={styles.target}>
					<HexPuzzleBoard
						radius={currentPuzzle.radius}
						colors={currentPuzzle.target}
						target
					/>
				</figure>
				<div
					className={styles.tray}
					role="group"
					aria-label="Puzzle pieces"
					data-puzzle-tray=""
				>
					{displayPieces.map((piece, index) => (
						<button
							type="button"
							key={piece.id}
							className={styles.piece}
							aria-label={`Select piece ${index + 1}, ${piece.tiles.length} ${piece.tiles.length === 1 ? 'tile' : 'tiles'}, ${placements[piece.id] ? 'on board' : 'in tray'}`}
							aria-pressed={selectedId === piece.id}
							aria-description={
								currentPuzzle.rotationAllowed
									? 'Click or tap to rotate 60 degrees; drag to move. Keyboard: Enter or Space rotates, then activate a board tile to place.'
									: undefined
							}
							disabled={Boolean(placements[piece.id])}
							onClick={() => activateTrayPiece(piece.id)}
							onPointerDown={event => {
								const tileIndex =
									event.target instanceof Element
										? Number(
												event.target
													.closest(
														'[data-piece-tile]',
													)
													?.getAttribute(
														'data-piece-tile',
													) ?? 0,
											)
										: 0
								startDrag(event, piece, piece.tiles[tileIndex])
							}}
						>
							<PieceGraphic piece={piece} />
						</button>
					))}
				</div>
			</div>
			<div className={styles.board}>
				<HexPuzzleBoard
					svgRef={boardRef}
					radius={currentPuzzle.radius}
					colors={colors}
					solved={solved}
					pieces={currentPuzzle.pieces}
					placements={placements}
					selectedId={selectedId}
					onActivate={activateCell}
					onReturn={cell => {
						const piece = pieceAt(cell)
						if (piece) returnToTray(piece.id)
					}}
					onGrab={(event, cell) => {
						const piece = pieceAt(cell)
						if (!piece) return
						const anchor = placements[piece.id]
						startDrag(event, piece, {
							q: cell.q - anchor.q,
							r: cell.r - anchor.r,
						})
					}}
				/>
			</div>

			<div
				role="status"
				className={previewPuzzle ? undefined : styles.visuallyHidden}
			>
				{solved
					? previewPuzzle
						? 'Playtest solved! No player progress recorded.'
						: 'Puzzle solved! Your design matches the target.'
					: message}
			</div>
			<div className={styles.actions}>
				{!previewPuzzle && <DarkModeToggle />}
				{solved && !previewPuzzle && (
					<Button onClick={() => reset(true)}>Next puzzle</Button>
				)}
				{previewPuzzle ? (
					<IconButton
						size="sm"
						icon={faRotate}
						label="Restart"
						onClick={() => reset(false)}
					/>
				) : (
					<PlayerIconButton
						icon={faRotate}
						label="Restart"
						onClick={() => reset(false)}
					/>
				)}
			</div>
			{!previewPuzzle && (
				<Modal
					open={showCongrats && !hidden}
					onClose={() => setShowCongrats(false)}
					labelledBy={congratsTitleId}
					size="sm"
					closeLabel="Close congratulations"
					header={<h2 id={congratsTitleId}>Congrats!</h2>}
				>
					<Button onClick={() => reset(true)}>Next Puzzle</Button>
				</Modal>
			)}
			{drag?.moved && !hidden && (
				<PieceGraphic piece={drag.piece} drag={drag} />
			)}
		</section>
	)
}
