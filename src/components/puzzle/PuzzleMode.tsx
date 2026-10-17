import type { AxialCoord } from '@appTypes/hexagon'
import { DarkModeToggle } from '@controls'
import { colorSchemes } from '@data/colorSchemes'
import { faRotate } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { Button, IconButton, Modal } from '@shared'
import type { PointerEvent } from 'react'
import { useId, useRef, useState } from 'react'
import type { PuzzlePiece, PuzzlePlacements } from '../../puzzles/hexPuzzle'
import {
	coordinateKey,
	generateHexPuzzle,
	getPuzzleColors,
	isPuzzleSolved,
	pieceCells,
	placePuzzlePiece,
} from '../../puzzles/hexPuzzle'
import HexPuzzleBoard, { PieceGraphic } from './HexPuzzleBoard'
import styles from './PuzzleMode.module.css'

interface DragState {
	readonly piece: PuzzlePiece
	readonly pointerId: number
	readonly offset: AxialCoord
	readonly startX: number
	readonly startY: number
	readonly x: number
	readonly y: number
	readonly scale: number
	readonly anchor: AxialCoord | null
	readonly moved: boolean
}

function createPuzzleSeed(): string {
	return Array.from(crypto.getRandomValues(new Uint32Array(4)), value =>
		value.toString(16).padStart(8, '0'),
	).join('')
}

export default function PuzzleMode({
	hidden = false,
	initialSeed,
}: {
	readonly hidden?: boolean
	readonly initialSeed?: string
}) {
	const [puzzle, setPuzzle] = useState(() =>
		generateHexPuzzle(initialSeed ?? createPuzzleSeed(), colorSchemes[1]),
	)
	const [placements, setPlacements] = useState<PuzzlePlacements>({})
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [showCongrats, setShowCongrats] = useState(false)
	const congratsTitleId = useId()
	const [message, setMessage] = useState('Choose a piece to get started.')
	const [drag, setDrag] = useState<DragState | null>(null)
	const dragRef = useRef<DragState | null>(null)
	const boardRef = useRef<SVGSVGElement>(null)
	const suppressClickRef = useRef(false)
	const colors = getPuzzleColors(puzzle, placements)
	const solved = isPuzzleSolved(puzzle, placements)

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
		const result = placePuzzlePiece(puzzle, placements, id, anchor)
		if (!result.ok) {
			setSelectedId(id)
			setMessage(result.reason)
			return
		}
		setPlacements(result.placements)
		setSelectedId(null)
		setShowCongrats(isPuzzleSolved(puzzle, result.placements))
		setMessage(
			Object.keys(result.placements).length === puzzle.pieces.length &&
				!isPuzzleSolved(puzzle, result.placements)
				? 'All pieces fit, but the colors do not match yet. Try rearranging them.'
				: 'Piece placed. Choose another piece or move one already on the board.',
		)
	}

	function pieceAt(cell: AxialCoord) {
		return puzzle.pieces.find(piece => {
			const anchor = placements[piece.id]
			return (
				anchor &&
				pieceCells(piece, anchor).some(
					tile => coordinateKey(tile) === coordinateKey(cell),
				)
			)
		})
	}

	function activateCell(cell: AxialCoord) {
		if (solved) return
		if (suppressClickRef.current) {
			suppressClickRef.current = false
			return
		}
		if (selectedId) place(selectedId, cell)
		else {
			const piece = pieceAt(cell)
			if (piece) selectPiece(piece.id)
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
		if (!current.moved) return
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
		setMessage('Piece returned to the tray.')
	}

	function reset(newPuzzle: boolean) {
		setShowCongrats(false)
		if (newPuzzle) {
			setPuzzle(generateHexPuzzle(createPuzzleSeed(), colorSchemes[1]))
		}
		setPlacements({})
		setSelectedId(null)
		dragRef.current = null
		setDrag(null)
		suppressClickRef.current = false
		setMessage('Choose a piece to get started.')
	}

	return (
		<section
			hidden={hidden}
			className={styles.puzzle}
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
				setMessage('Drag cancelled. Your piece has not moved.')
			}}
		>
			<div className={styles.goalAndPieces}>
				<figure className={styles.target}>
					<HexPuzzleBoard
						radius={puzzle.radius}
						colors={puzzle.target}
						target
					/>
				</figure>
				<div
					className={styles.tray}
					role="group"
					aria-label="Puzzle pieces"
					data-puzzle-tray=""
				>
					{puzzle.pieces.map((piece, index) => (
						<button
							type="button"
							key={piece.id}
							className={styles.piece}
							aria-label={`Select piece ${index + 1}, ${piece.tiles.length} ${piece.tiles.length === 1 ? 'tile' : 'tiles'}, ${placements[piece.id] ? 'on board' : 'in tray'}`}
							aria-pressed={selectedId === piece.id}
							disabled={Boolean(placements[piece.id])}
							onClick={() => selectPiece(piece.id)}
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
					radius={puzzle.radius}
					colors={colors}
					solved={solved}
					pieces={puzzle.pieces}
					placements={placements}
					selectedId={selectedId}
					onActivate={activateCell}
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

			<div role="status" className={styles.visuallyHidden}>
				{solved
					? 'Puzzle solved! Your design matches the target.'
					: message}
			</div>
			<div className={styles.actions}>
				<DarkModeToggle />
				{solved && (
					<Button onClick={() => reset(true)}>Next puzzle</Button>
				)}
				<IconButton
					icon={faRotate}
					label="Restart"
					onClick={() => reset(false)}
				/>
			</div>
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
			{drag?.moved && !hidden && (
				<PieceGraphic piece={drag.piece} drag={drag} />
			)}
		</section>
	)
}
